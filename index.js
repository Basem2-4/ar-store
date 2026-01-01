const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // تأكد من وجود مكتبة dotenv مثبتة

const app = express();
app.use(express.json());
app.use(cors());

// 1. الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB ✅'))
    .catch(err => console.error('MongoDB Connection Error ❌', err));

// 2. إعداد البوت مع الصلاحيات اللازمة (Intents)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // ضروري لجلب بيانات المستخدمين
    ]
});

// متغيرات البيئة (تأكد من إضافتها في Render)
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1069269164667179109"; 

// 3. المسار المخصص لاستقبال طلبات الموقع
app.post('/api/create-ticket', async (req, res) => {
    const { discordId, orderDetails, totalPrice, orderId } = req.body;

    // طباعة البيانات المستلمة في Logs للتأكد
    console.log(`📥 طلب استلام: Discord ID: ${discordId}, Order: ${orderId}`);

    if (!discordId || discordId === 'undefined') {
        return res.status(400).json({ success: false, error: 'Discord ID is missing' });
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // جلب المستخدم (Fetch) لضمان عدم حدوث خطأ "Not Cached"
        let member;
        try {
            member = await guild.members.fetch(discordId.trim());
        } catch (e) {
            console.error("❌ المستخدم غير موجود في السيرفر");
            return res.status(404).json({ success: false, error: 'User not found in Discord server' });
        }

        // إنشاء قناة التذكرة
        const channel = await guild.channels.create({
            name: `ticket-${orderId || 'new'}`,
            type: 0, // Text Channel
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${member.id}>\nتم فتح هذه التذكرة لمتابعة طلبك مع الإدارة.`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId || 'N/A'}`, inline: true },
                { name: 'الإجمالي', value: `${totalPrice || '0'}`, inline: true },
                { name: 'التفاصيل', value: orderDetails || 'لا توجد تفاصيل' }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, 
            embeds: [embed] 
        });

        res.status(200).json({ success: true, channelId: channel.id });

    } catch (error) {
        console.error('❌ خطأ برمجيا أثناء إنشاء التذكرة:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} 🤖`);
});

client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${port}`);
});
