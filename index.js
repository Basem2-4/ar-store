const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
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

// تعريف الجداول (Models)
const Counter = mongoose.model('Counter', new mongoose.Schema({ id: String, seq: Number }));

const orderSchema = new mongoose.Schema({
    orderNumber: Number,
    productName: String,
    discordId: String,
    totalPrice: String,
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// 2. إعداد البوت
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// 3. مسارات الـ API

// مسار جلب الطلبات للمسؤول (جديد)
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).limit(20);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: "فشل جلب الطلبات" });
    }
});

// مسار إنشاء التذكرة وحفظ الطلب
app.post('/api/create-ticket', async (req, res) => {
    const data = req.body;
    
    // استلام البيانات كما أرسلناها من الموقع
    const productName = data.orderDetails || "منتج غير معروف";
    const discordId = data.discordId;
    const totalPrice = data.totalPrice || '0';

    if (!discordId) return res.status(400).json({ success: false, error: 'Discord ID missing' });

    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        // زيادة رقم الطلب
        const counter = await Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true });
        const orderId = counter.seq;

        const member = await guild.members.fetch(discordId.trim()).catch(() => null);
        if (!member) return res.status(404).json({ success: false, error: 'User not found in Discord' });

        // حفظ الطلب في MongoDB ليراه المسؤول في الموقع
        const newOrder = new Order({
            orderNumber: orderId,
            productName: productName,
            discordId: discordId,
            totalPrice: totalPrice
        });
        await newOrder.save();

        // إنشاء قناة التذكرة
        const channel = await guild.channels.create({
            name: `ticket-${orderId}`,
            type: 0,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - Al-Amariyah RP')
            .setColor('#FFD700')
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'ايدي الديسكورد', value: `${discordId}`, inline: true },
                { name: 'التفاصيل', value: `${productName}`, inline: false },
                { name: 'الإجمالي', value: `${totalPrice}`, inline: false },
                { name: 'الوقت', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'نظام الطلبات الآلي' });

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, embeds: [embed] });
        res.status(200).json({ success: true, channelId: channel.id });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ success: false });
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server on port ${port}`));
