const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // تفعيل مكتبة dotenv

const app = express();
app.use(express.json());
app.use(cors());

// الاتصال بـ MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB ✅'))
    .catch(err => console.error('MongoDB Connection Error ❌', err));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// جلب الإعدادات من متغيرات البيئة
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1069269164667179109"; // تم وضع الأيدي الذي أرسلته هنا مباشرة لضمان الدقة

app.post('/api/create-ticket', async (req, res) => {
    const { discordId, orderDetails, totalPrice, orderId } = req.body;

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // التأكد من أن الأيدي المرسل من الموقع لا يحتوي على مسافات
        const memberId = discordId.trim();

        const channel = await guild.channels.create({
            name: `ticket-${orderId}`,
            type: 0, 
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: memberId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${memberId}>\nتم فتح هذه التذكرة لمتابعة طلبك.`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'الإجمالي', value: `${totalPrice}`, inline: true },
                { name: 'التفاصيل', value: orderDetails || 'لا توجد تفاصيل' }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${memberId}>`, embeds: [embed] });

        res.status(200).json({ success: true, channelId: channel.id });
    } catch (error) {
        console.error('Error details:', error); // طباعة الخطأ بالتفصيل في الـ Logs
        res.status(500).json({ success: false, error: 'Failed to create ticket' });
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
