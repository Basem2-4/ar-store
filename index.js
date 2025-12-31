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

const StoreSchema = new mongoose.Schema({
    configId: { type: String, default: "main" },
    products: Array,
    customBgs: Object
});
const Store = mongoose.model('Store', StoreSchema);

// --- مسارات البيانات ---
app.get('/get-store-data', async (req, res) => {
    try {
        let data = await Store.findOne({ configId: "main" });
        if (!data) data = { products: [], customBgs: {} };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "خطأ في جلب البيانات" }); }
});

app.post('/save-products', async (req, res) => {
    try {
        await Store.findOneAndUpdate({ configId: "main" }, { products: req.body.products }, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/save-bgs', async (req, res) => {
    try {
        await Store.findOneAndUpdate({ configId: "main" }, { customBgs: req.body.customBgs }, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
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

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835949405503591"; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// مصفوفة لمنع تكرار الضغط (Cooldown)
const processingTickets = new Set();

// --- مسار فتح التذكرة (محسن للسرعة القصوى) ---
app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        const guild = await client.guilds.fetch(GUILD_ID);
        const userId = buyerId.toString().trim();

        // إنشاء القناة
        const channel = await guild.channels.create({
            name: `ticket-${userId.slice(-4)}`, 
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { 
                    id: userId, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages, 
                        PermissionFlagsBits.ReadMessageHistory
                    ] 
                },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد')
            .setColor('#D4AF37')
            .addFields(
                { name: '👤 المشتري', value: `<@${userId}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '🔢 الكمية', value: qty.toString(), inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true },
                { name: '📝 الاستخدام', value: usage || 'غير محدد', inline: true }
            )
            .setTimestamp();

        const closeBtn = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('إغلاق التذكرة')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');
            
        const row = new ActionRowBuilder().addComponents(closeBtn);

        // إرسال الرسالة
        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${userId}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

        // الرد على الموقع فوراً
        res.json({ success: true });

    } catch (error) {
        console.error("Ticket Opening Error:", error);
        res.status(500).json({ success: false, error: "حدث خطأ أثناء فتح التذكرة" });
    }
});

// --- معالجة إغلاق التذكرة ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket') {
        if (processingTickets.has(interaction.channel.id)) return;
        processingTickets.add(interaction.channel.id);

        try {
            // الرد الفوري لتجنب Unknown Interaction
            await interaction.reply({ 
                content: '🔒 جاري الحذف فوراً...', 
                flags: [4096] 
            });

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const closeLogEmbed = new EmbedBuilder()
                    .setTitle('🔒 تم إغلاق تذكرة')
                    .setColor('#ff0000')
                    .addFields(
                        { name: '📝 القناة', value: interaction.channel.name, inline: true },
                        { name: '👤 بواسطة', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setTimestamp();
                
                logChannel.send({ embeds: [closeLogEmbed] }).catch(() => {});
            }

            // الحذف بعد ثانية واحدة
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error("Delete Error:", err.message);
                } finally {
                    processingTickets.delete(interaction.channel.id);
                }
            }, 1000);

        } catch (error) {
            processingTickets.delete(interaction.channel.id);
            console.error("Interaction Error:", error.message);
        }
    }
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${port}`);
});

client.login(process.env.TOKEN);
