const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB ✅'))
    .catch(err => console.error('MongoDB Connection Error ❌', err));

const Counter = mongoose.model('Counter', new mongoose.Schema({ id: String, seq: Number }));

// 2. إعداد البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1324422204557004860"; 
const ADMIN_ROLE_ID = "1069269164667179109"; 

// 3. مسار إنشاء التذكرة
app.post('/api/create-ticket', async (req, res) => {
    const data = req.body;
    const finalDiscordId = data.discordId || data.userId;
    const finalPrice = data.totalPrice || data.price || '0';
    const finalProduct = data.productName || data.item || 'منتج غير معروف';
    const finalCategory = data.categoryName || data.category || 'عام';
    const finalQty = data.quantity || data.qty || 1;

    if (!finalDiscordId) return res.status(400).json({ success: false, error: 'Discord ID missing' });

    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        // جلب العضو والتأكد من وجوده لحل خطأ PermissionOverwrites
        const member = await guild.members.fetch(finalDiscordId.trim()).catch(() => null);
        if (!member) return res.status(404).json({ success: false, error: 'Member not found in guild' });

        const orderId = await Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).then(d => d.seq);

        const channel = await guild.channels.create({
            name: `ticket-${orderId}`,
            type: 0,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${member.id}>\nتم فتح تذكرة لمتابعة طلبك.\n\n**قسم الطلب:** ${finalCategory}`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'المنتج المطلوب', value: `${finalProduct} النسخ ${finalQty}`, inline: true },
                { name: 'الإجمالي', value: `${finalPrice}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, embeds: [embed], components: [row] });
        res.status(200).json({ success: true, channelId: channel.id });

    } catch (error) {
        console.error('❌ Error creating ticket:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. نظام إغلاق التذكرة (إصلاح خطأ التفاعل المجهول)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'close_ticket') return;

    try {
        // حل مشكلة Unknown interaction: الرد فوراً قبل أي عملية أخرى
        await interaction.reply({ content: '🔒 جاري إغلاق التذكرة وأرشفة البيانات...', ephemeral: true });

        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        
        const logEmbed = new EmbedBuilder()
            .setTitle('🔒 تذكرة مغلقة')
            .setColor('#ff0000')
            .addFields(
                { name: 'اسم التذكرة', value: `${interaction.channel.name}`, inline: true },
                { name: 'أغلقت بواسطة', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        if (logChannel) {
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        // حذف الروم بعد وقت قصير لضمان وصول اللوق
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);

    } catch (err) {
        console.error('Interaction Error:', err.message);
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server on port ${port}`));
