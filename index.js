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

// الاتصال بـ MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ متصل بقاعدة البيانات"))
    .catch(err => console.error("❌ خطأ قاعدة البيانات:", err));

const Store = mongoose.model('Store', new mongoose.Schema({
    configId: { type: String, default: "main" },
    products: Array,
    customBgs: Object
}));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835949405503591"; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

const processingTickets = new Set();

// --- مسار فتح التذكرة المحدث لحل مشكلة الـ Cache والسرعة ---
app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // حل مشكلة InvalidType: جلب العضو للتأكد من وجوده في الكاش
        const member = await guild.members.fetch(buyerId.toString().trim()).catch(() => null);
        
        if (!member) {
            return res.status(400).json({ success: false, error: "العضو غير موجود في السيرفر" });
        }

        const channel = await guild.channels.create({
            name: `ticket-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { 
                    id: member.id, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
                },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد')
            .setColor('#D4AF37')
            .addFields(
                { name: '👤 المشتري', value: `<@${member.id}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true },
                { name: '📝 الاستخدام', value: usage || 'غير محدد', inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${member.id}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

        res.json({ success: true });
    } catch (error) {
        console.error("فتح التذكرة:", error.message);
        res.status(500).json({ success: false });
    }
});

// --- معالجة إغلاق التذكرة ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'close_ticket') return;

    if (processingTickets.has(interaction.channelId)) return;
    processingTickets.add(interaction.channelId);

    try {
        // الرد بـ flags: 4096 بدلاً من ephemeral المتوقف
        await interaction.reply({ content: '🔒 جاري حذف التذكرة...', flags: [4096] });

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🔒 إغلاق تذكرة')
                .setDescription(`بواسطة: <@${interaction.user.id}>\nالقناة: ${interaction.channel.name}`)
                .setColor('#ff0000')
                .setTimestamp();
            logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (e) { }
            processingTickets.delete(interaction.channelId);
        }, 1500);

    } catch (error) {
        processingTickets.delete(interaction.channelId);
        console.error("خطأ الإغلاق:", error.message);
    }
});

app.get('/', (req, res) => res.send('Server Online 🚀'));
const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 منفذ: ${port}`));

client.login(process.env.TOKEN);
