const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

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

// الإعدادات الثابتة (تأكد من صحتها في سيرفرك)
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1069269164667179109"; // الآيدي الذي أرسلته

app.post('/api/create-ticket', async (req, res) => {
    const { discordId, orderDetails, totalPrice, orderId } = req.body;

    // فحص أولي للبيانات لضمان عدم حدوث TypeError
    if (!discordId || discordId === 'undefined') {
        console.error("❌ خطأ: لم يتم استلام Discord ID من الموقع");
        return res.status(400).json({ success: false, error: 'Discord ID is missing' });
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const cleanDiscordId = discordId.trim();

        const channel = await guild.channels.create({
            name: `ticket-${orderId || 'new'}`,
            type: 0, 
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: cleanDiscordId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${cleanDiscordId}>\nتم فتح هذه التذكرة لمتابعة طلبك.`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId || 'غير معروف'}`, inline: true },
                { name: 'الإجمالي', value: `${totalPrice || '0'}`, inline: true },
                { name: 'التفاصيل', value: orderDetails || 'لا توجد تفاصيل' }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${cleanDiscordId}>`, embeds: [embed] });

        res.status(200).json({ success: true, channelId: channel.id });
    } catch (error) {
        console.error('❌ تفاصيل الخطأ في الديسكورد:', error.message);
        res.status(500).json({ success: false, error: error.message });
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
