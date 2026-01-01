const { 
    Client, GatewayIntentBits, EmbedBuilder, ChannelType, 
    PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    MessageFlags // أضفنا هذه هنا لحل مشكلة التحذير
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

// لتجنب تكرار حذف القناة
const closedChannels = new Set();

// --- مسار فتح التذكرة ---
app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        
        // رد فوري للموقع
        res.json({ success: true });

        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return console.error("❌ لم يتم العثور على السيرفر");

        const userId = buyerId.toString().trim();
        let member = await guild.members.fetch(userId).catch(() => null);

        const targetId = member ? member.id : userId;
        const channelName = member ? `طلب-${member.user.username}` : `ticket-${userId.slice(-4)}`;

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { 
                    id: targetId, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
                },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد')
            .setColor('#D4AF37')
            .addFields(
                { name: '👤 المشتري', value: `<@${targetId}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket_btn').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | طلب جديد من <@${targetId}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

    } catch (error) {
        console.error("⚠️ خطأ في فتح التذكرة:", error.message);
    }
});

// --- معالجة زر الإغلاق (تم تحديثها لحل مشكلة التحذير) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket_btn') {
        if (closedChannels.has(interaction.channelId)) return;
        closedChannels.add(interaction.channelId);

        try {
            // حل مشكلة التحذير هنا: استخدمنا MessageFlags.Ephemeral بدلاً من ephemeral: true
            await interaction.deferReply({ 
                flags: [MessageFlags.Ephemeral] 
            }).catch(() => {});

            // إرسال اللوج
            const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔒 إغلاق تذكرة')
                    .setColor('#ff0000')
                    .setDescription(`بواسطة: <@${interaction.user.id}>\nالقناة: ${interaction.channel.name}`)
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }

            await interaction.editReply({ content: '🔒 تم استلام الطلب، سيتم حذف القناة الآن...' }).catch(() => {});

            // الحذف بعد ثانية واحدة
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    console.error("خطأ أثناء حذف القناة:", e.message);
                } finally {
                    closedChannels.delete(interaction.channelId);
                }
            }, 1000);

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
