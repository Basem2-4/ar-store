const { 
    Client, GatewayIntentBits, EmbedBuilder, ChannelType, 
    PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    MessageFlags 
} = require('discord.js');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- قاعدة البيانات ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// --- إعدادات البوت ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers
    ]
});

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835949405503591"; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

const closedChannels = new Set();

// --- مسار فتح التذكرة (محسن للسرعة) ---
app.post('/open-ticket', async (req, res) => {
    // الرد الفوري للموقع لإنهاء التحميل في المتصفح
    res.status(200).json({ success: true });

    try {
        const { productName, buyerId, total } = req.body;
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        if (!guild) return;

        // إنشاء القناة بسرعة باستخدام ID المشتري مباشرة
        const channel = await guild.channels.create({
            name: `طلب-${buyerId.toString().slice(-4)}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { 
                    id: buyerId, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
                },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد')
            .setColor('#D4AF37')
            .addFields(
                { name: '👤 المشتري', value: `<@${buyerId}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket_btn').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${buyerId}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

    } catch (error) {
        console.error("⚠️ خطأ في فتح التذكرة:", error.message);
    }
});

// --- معالجة زر الإغلاق (حل مشكلة Interaction Failed) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket_btn') {
        // أهم خطوة: الرد فوراً على ديسكورد لتجنب رسالة Interaction Failed
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        } catch (e) { return; }

        if (closedChannels.has(interaction.channelId)) return;
        closedChannels.add(interaction.channelId);

        try {
            // إرسال اللوج في الخلفية
            const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔒 إغلاق تذكرة')
                    .setColor('#ff0000')
                    .setDescription(`بواسطة: <@${interaction.user.id}>\nالقناة: ${interaction.channel.name}`)
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }

            // تحديث الرد لإعلام المستخدم بالنجاح
            await interaction.editReply({ content: '🔒 جارٍ إغلاق القناة وحذفها...' });

            // الحذف الفعلي بعد وقت قصير جداً
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    console.error("خطأ أثناء حذف القناة:", e.message);
                } finally {
                    closedChannels.delete(interaction.channelId);
                }
            }, 1500);

        } catch (error) {
            closedChannels.delete(interaction.channelId);
            console.error("خطأ في تفاعل الإغلاق:", error.message);
        }
    }
});

app.get('/', (req, res) => res.send('Bot Status: Online 🚀'));
const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 السيرفر يعمل على المنفذ ${port}`));

client.login(process.env.TOKEN);
