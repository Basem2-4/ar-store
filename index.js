const { 
    Client, GatewayIntentBits, EmbedBuilder, ChannelType, 
    PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder 
} = require('discord.js');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors()); 
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ متصل ببقاعدة البيانات"))
    .catch(err => console.error("❌ فشل الاتصال:", err));

const StoreSchema = new mongoose.Schema({
    configId: { type: String, default: "main" },
    products: Array,
    customBgs: Object
});
const Store = mongoose.model('Store', StoreSchema);

// --- مسارات البيانات ---
app.get('/get-store-data', async (req, res) => {
    try {
        const data = await Store.findOne({ configId: "main" }) || { products: [], customBgs: {} };
        res.json(data);
    } catch (err) { res.status(500).send(err); }
});

app.post('/save-products', async (req, res) => {
    await Store.findOneAndUpdate({ configId: "main" }, { products: req.body.products }, { upsert: true });
    res.json({ success: true });
});

app.post('/save-bgs', async (req, res) => {
    await Store.findOneAndUpdate({ configId: "main" }, { customBgs: req.body.customBgs }, { upsert: true });
    res.json({ success: true });
});

app.get('/', (req, res) => res.send('Server Online'));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// --- تحسين سرعة فتح التذكرة ---
app.post('/open-ticket', async (req, res) => {
    res.json({ success: true }); // الرد فوراً على الموقع لإنهاء حالة الانتظار هناك

    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        // محاولة جلب العضو من الكاش أولاً لتوفير الوقت
        let member = guild.members.cache.get(buyerId.toString().trim());
        if (!member) {
            member = await guild.members.fetch(buyerId.toString().trim()).catch(() => null);
        }

        if (!member) return;

        // إنشاء القناة
        const channel = await guild.channels.create({
            name: `طلب-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد')
            .setColor('#D4AF37')
            .addFields(
                { name: '👤 المشتري', value: `<@${member.id}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '🔢 الكمية', value: qty.toString(), inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true },
                { name: '📝 الاستخدام', value: usage || 'غير محدد', inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${member.id}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

    } catch (error) {
        console.error("Ticket Error:", error);
    }
});

// زر الإغلاق السريع
client.on('interactionCreate', async (i) => {
    if (!i.isButton() || i.customId !== 'close_ticket') return;
    
    await i.reply('🔒 سيتم حذف التذكرة...');
    setTimeout(() => i.channel.delete().catch(() => {}), 3000);
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`Server on ${port}`));

client.login(process.env.TOKEN);
