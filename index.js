client.login(process.env.TOKEN);
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());

// 1. الاتصال بقاعدة بيانات MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB ✅'))
    .catch(err => console.error('MongoDB Connection Error ❌', err));

// 2. إعداد إعدادات البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// متغيرات البيئة (يجب ضبطها في Render)
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; // ايدي الكاتيجوري اللي بتفتح فيه التذاكر
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // ايدي رتبة الإدارة للمنشن

// 3. API لاستقبال طلبات الشراء من الموقع
app.post('/api/create-ticket', async (req, res) => {
    const { discordId, orderDetails, totalPrice, orderId } = req.body;

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // إنشاء التذكرة (Channel)
        const channel = await guild.channels.create({
            name: `ticket-${orderId}`,
            type: 0, // Text Channel
            parent: CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: guild.id, // منع الجميع من الرؤية
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: discordId, // السماح للمشتري بالرؤية
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
                {
                    id: ADMIN_ROLE_ID, // السماح للإدارة بالرؤية
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
            ],
        });

        // إنشاء رسالة الترحيب (الذهبية)
        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') // اللون الذهبي
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

// تشغيل البوت
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} 🤖`);
});

client.login(process.env.BOT_TOKEN);

// تشغيل سيرفر الـ Express (للرابط مع Render)
const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${port}`);
});
