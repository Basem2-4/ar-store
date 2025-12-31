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

// --- إعداد الاتصال بقاعدة بيانات MongoDB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ متصل بقاعدة بيانات MongoDB بنجاح!"))
    .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

// تعريف "الموديل" لحفظ بيانات المتجر
const StoreSchema = new mongoose.Schema({
    configId: { type: String, default: "main" },
    products: Array,
    customBgs: Object
});
const Store = mongoose.model('Store', StoreSchema);

// --- مسارات جلب وحفظ البيانات ---
app.get('/get-store-data', async (req, res) => {
    try {
        let data = await Store.findOne({ configId: "main" });
        if (!data) data = { products: [], customBgs: {} };
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "خطأ في جلب البيانات" });
    }
});

app.post('/save-products', async (req, res) => {
    try {
        await Store.findOneAndUpdate({ configId: "main" }, { products: req.body.products }, { upsert: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/save-bgs', async (req, res) => {
    try {
        await Store.findOneAndUpdate({ configId: "main" }, { customBgs: req.body.customBgs }, { upsert: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.send('Server is Online 🚀'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN; 
const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835949405503591"; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        const guild = await client.guilds.fetch(GUILD_ID);
        
        let member;
        try {
            member = await guild.members.fetch(buyerId.toString().trim());
        } catch (e) {
            return res.status(400).json({ success: false, error: "الايدي غير صحيح أو الشخص غير موجود بالسيرفر" });
        }

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
            )
            .setTimestamp();

        const closeBtn = new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒');
        const row = new ActionRowBuilder().addComponents(closeBtn);

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${member.id}>`, embeds: [ticketEmbed], components: [row] });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- تعديل لوق إغلاق التذكرة لحل مشكلة Unknown Interaction ---
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;

    if (i.customId === 'close_ticket') {
        try {
            // نستخدم deferReply لضمان عدم انتهاء صلاحية التفاعل
            await i.deferReply();

            const logChannel = i.guild.channels.cache.get(LOG_CHANNEL_ID);
            
            // إنشاء إمبيد اللوج
            const closeLogEmbed = new EmbedBuilder()
                .setTitle('🔒 تم إغلاق تذكرة')
                .setColor('#ff0000')
                .addFields(
                    { name: '📝 اسم القناة', value: i.channel.name, inline: true },
                    { name: '👤 أغلق بواسطة', value: `<@${i.user.id}>`, inline: true }
                )
                .setTimestamp();

            // إرسال اللوج قبل حذف القناة
            if (logChannel) {
                await logChannel.send({ embeds: [closeLogEmbed] }).catch(() => {});
            }

            // تعديل الرد الأصلي لإعلام المستخدم بالحذف
            await i.editReply('⚠️ سيتم حذف القناة خلال 5 ثوانٍ...');
            
            setTimeout(() => {
                i.channel.delete().catch(() => {});
            }, 5000);

        } catch (error) {
            console.error("Error handling close button:", error);
        }
    }
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${port}`);
});

client.login(process.env.TOKEN);
