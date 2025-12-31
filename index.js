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

// --- قاعدة البيانات ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

const Store = mongoose.model('Store', new mongoose.Schema({
    configId: { type: String, default: "main" },
    products: Array,
    customBgs: Object
}));

// --- إعدادات البوت ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835949405503591"; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

const processingTickets = new Set();

// --- مسارات جلب البيانات للموقع ---
app.get('/get-store-data', async (req, res) => {
    try {
        let data = await Store.findOne({ configId: "main" });
        if (!data) data = { products: [], customBgs: {} };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Data fetch error" }); }
});

// --- فتح التذكرة (مسرّع) ---
app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        
        // استجابة فورية للموقع لمنع اللودينج الطويل
        res.json({ success: true });

        const guild = await client.guilds.fetch(GUILD_ID);
        const userId = buyerId.toString().trim();

        // حل مشكلة "Not a cached User" بالبحث عن العضو أولاً
        let member = guild.members.cache.get(userId);
        if (!member) {
            member = await guild.members.fetch(userId).catch(() => null);
        }

        if (!member) return console.log(`❌ العضو ${userId} غير موجود بالسيرفر`);

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
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true },
                { name: '📝 الاستخدام', value: usage || 'غير محدد', inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${member.id}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

    } catch (error) {
        console.error("⚠️ Error opening ticket:", error.message);
    }
});

// --- إغلاق التذكرة (بدون تأخير) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'close_ticket') return;

    if (processingTickets.has(interaction.channel.id)) return;
    processingTickets.add(interaction.channel.id);

    try {
        // رد فوري لتجنب الـ Unknown Interaction
        await interaction.reply({ content: '🔒 سيتم حذف القناة فوراً...', flags: [4096] });

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🔒 تم إغلاق تذكرة')
                .setColor('#ff0000')
                .setDescription(`القناة: ${interaction.channel.name}\nبواسطة: <@${interaction.user.id}>`)
                .setTimestamp();
            logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        // الحذف بعد ثانية واحدة
        setTimeout(async () => {
            try {
                if (interaction.channel) {
                    await interaction.channel.delete();
                }
            } catch (err) {
                console.error("Delete error:", err.message);
            } finally {
                processingTickets.delete(interaction.channel.id);
            }
        }, 1000);

    } catch (error) {
        processingTickets.delete(interaction.channel.id);
        console.error("Interaction error:", error.message);
    }
});

app.get('/', (req, res) => res.send('Bot is Live!'));
const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server on port ${port}`));

client.login(process.env.TOKEN);
