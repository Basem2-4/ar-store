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
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

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

// --- مسار فتح التذكرة (مسرع ومصحح) ---
app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        
        // استجابة فورية للموقع لإنهاء التحميل
        res.json({ success: true });

        const guild = await client.guilds.fetch(GUILD_ID);
        const userId = buyerId.toString().trim();

        // حل مشكلة "Not a cached User"
        let member = guild.members.cache.get(userId);
        if (!member) {
            member = await guild.members.fetch(userId).catch(() => null);
        }

        if (!member) return console.log(`❌ العضو ${userId} غير موجود`);

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

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد')
            .setColor('#D4AF37')
            .addFields(
                { name: '👤 المشتري', value: `<@${member.id}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        // تصحيح: الإرسال داخل دالة async
        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${member.id}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

    } catch (error) {
        console.error("⚠️ Error opening ticket:", error.message);
    }
});

// --- إغلاق التذكرة (حل مشكلة التعليق والـ Syntax) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'close_ticket') return;

    if (processingTickets.has(interaction.channelId)) return;
    processingTickets.add(interaction.channelId);

    try {
        // رد فوري لتجنب Unknown interaction (استخدام flags بدلاً من ephemeral)
        await interaction.reply({ content: '🔒 جاري الحذف...', flags: [4096] });

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🔒 إغلاق تذكرة')
                .setDescription(`بواسطة: <@${interaction.user.id}>\nالقناة: ${interaction.channel.name}`)
                .setColor('#ff0000');
            logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        // الحذف المباشر (ثانية واحدة فقط)
        setTimeout(async () => {
            try {
                const channel = interaction.guild.channels.cache.get(interaction.channelId);
                if (channel) await channel.delete();
            } catch (e) { }
            processingTickets.delete(interaction.channelId);
        }, 1000);

    } catch (error) {
        processingTickets.delete(interaction.channelId);
        console.error("Interaction Error:", error.message);
    }
});

app.get('/', (req, res) => res.send('Bot Online!'));
const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server on port ${port}`));

client.login(process.env.TOKEN);
