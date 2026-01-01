// 1. استدعاء المكتبات أولاً
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');

// تحميل متغيرات البيئة (dotenv) - يجب أن يكون في الأعلى
require('dotenv').config();

const app = express();
app.use(express.json());

// 2. إعداد البوت (Initialization)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 3. الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB ✅'))
    .catch(err => console.error('MongoDB Connection Error ❌', err));

// متغيرات البيئة من Render
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; 

// 4. الـ API الخاص بالتذاكر
app.post('/api/create-ticket', async (req, res) => {
    const { discordId, orderDetails, totalPrice, orderId } = req.body;
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const channel = await guild.channels.create({
            name: `ticket-${orderId}`,
            type: 0, 
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: discordId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${discordId}>\nتم فتح هذه التذكرة لمتابعة طلبك.`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'الإجمالي', value: `${totalPrice} SR`, inline: true },
                { name: 'التفاصيل', value: orderDetails }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${discordId}>`, embeds: [embed] });
        res.status(200).json({ success: true, channelId: channel.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to create ticket' });
    }
});

// 5. تشغيل البوت (في نهاية الملف)
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} 🤖`);
});

// ملاحظة: تأكد أن الاسم في Render هو TOKEN أو BOT_TOKEN
client.login(process.env.TOKEN || process.env.BOT_TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${port}`);
});
