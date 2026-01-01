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

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI).catch(err => console.log("MongoDB Error:", err));

const StoreSchema = new mongoose.Schema({ configId: String, products: Array, customBgs: Object });
const Store = mongoose.model('Store', StoreSchema);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]
});

// المسارات لجلب البيانات (للمتجر)
app.get('/get-store-data', async (req, res) => {
    try {
        const data = await Store.findOne({ configId: "main" }) || { products: [], customBgs: {} };
        res.json(data);
    } catch (e) { res.status(500).json(e); }
});

app.post('/save-products', async (req, res) => {
    await Store.findOneAndUpdate({ configId: "main" }, { products: req.body.products }, { upsert: true });
    res.json({ success: true });
});

app.post('/save-bgs', async (req, res) => {
    await Store.findOneAndUpdate({ configId: "main" }, { customBgs: req.body.customBgs }, { upsert: true });
    res.json({ success: true });
});

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

app.post('/open-ticket', async (req, res) => {
    const { productName, buyerId, qty, total, usage } = req.body;

    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        if (!guild) return res.status(400).json({ success: false, error: "السيرفر غير موجود" });

        // التحقق من صحة الايدي
        const member = await guild.members.fetch(buyerId.trim()).catch(() => null);
        if (!member) return res.status(400).json({ success: false, error: "الايدي غير صحيح أو الشخص ليس بالسيرفر" });

        // إنشاء القناة
        const channel = await guild.channels.create({
            name: `ticket-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle('🛒 طلب جديد')
            .setDescription(`**المنتج:** ${productName}\n**الكمية:** ${qty}\n**الإجمالي:** ${total} SR\n**الاستخدام:** ${usage}`)
            .setColor('#D4AF37')
            .setTimestamp();

        await channel.send({ 
            content: `طلب جديد من: <@${member.id}> | <@&${ADMIN_ROLE_ID}>`,
            embeds: [embed], 
            components: [row] 
        });

        res.json({ success: true });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ success: false, error: "حدث خطأ داخلي" });
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.isButton() || i.customId !== 'close_ticket') return;
    try {
        await i.deferUpdate().catch(() => {}); 
        await i.channel.delete().catch(() => {});
    } catch (e) {}
});

client.login(process.env.TOKEN);
app.listen(process.env.PORT || 10000);
