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

// --- تعريف الجداول (Models) ---

// جدول العداد لترقيم الطلبات
const Counter = mongoose.model('Counter', new mongoose.Schema({ id: String, seq: Number }));

// جدول الطلبات
const orderSchema = new mongoose.Schema({
    orderNumber: Number,
    productName: String,
    discordId: String,
    totalPrice: String,
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// جدول بيانات المتجر (المنتجات، الشركات، الخلفيات) - هذا ما يمنع الاختفاء عند التحديث
const storeDataSchema = new mongoose.Schema({
    type: { type: String, unique: true }, // 'main_data'
    products: { type: Array, default: [] },
    companies: { type: Array, default: [] },
    backgrounds: { type: Object, default: { main: '', cars: '', real: '', shops: '' } },
    discounts: { type: Array, default: [] }
});
const StoreData = mongoose.model('StoreData', storeDataSchema);

// --- إعداد البوت ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// --- مسارات الـ API الربط مع الموقع ---

// 1. مسار جلب كل بيانات المتجر (يستدعيه الموقع عند refresh)
app.get('/api/get-store-data', async (req, res) => {
    try {
        let data = await StoreData.findOne({ type: 'main_data' });
        if (!data) {
            data = await StoreData.create({ type: 'main_data' });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "فشل جلب بيانات المتجر" });
    }
});

// 2. مسار تحديث البيانات من لوحة التحكم (إضافة منتج، تغيير خلفية...)
app.post('/api/update-store-data', async (req, res) => {
    const { type, payload } = req.body; // type: products, companies, backgrounds...
    try {
        const update = {};
        update[type] = payload;
        await StoreData.findOneAndUpdate({ type: 'main_data' }, { $set: update }, { upsert: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "فشل تحديث البيانات" });
    }
});

// 3. مسار إنشاء التذكرة وحفظ الطلب
app.post('/api/create-ticket', async (req, res) => {
    const data = req.body;
    const productName = data.items || "منتج غير معروف"; // تم تعديل المسمى ليتوافق مع الموقع
    const discordId = data.discordId || "لم يتم إدخاله";
    const totalPrice = data.price || '0'; // تم تعديل المسمى ليتوافق مع الموقع

    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        const counter = await Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true });
        const orderId = counter.seq;

        // حفظ في قاعدة البيانات لظهوره في سجل الموقع
        const newOrder = new Order({
            orderNumber: orderId,
            productName: productName,
            discordId: discordId,
            totalPrice: totalPrice
        });
        await newOrder.save();

        // إرسال للديسكورد (إذا وجد العضو)
        let memberMention = discordId;
        const member = await guild.members.fetch(discordId.trim()).catch(() => null);
        if (member) memberMention = `<@${member.id}>`;

        const channel = await guild.channels.create({
            name: `ticket-${orderId}`,
            type: 0,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                member ? { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] } : null,
            ].filter(Boolean),
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - Al-Amariyah RP')
            .setColor('#FFD700')
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'صاحب الطلب', value: `${memberMention}`, inline: true },
                { name: 'التفاصيل', value: `${productName}`, inline: false },
                { name: 'الإجمالي', value: `${totalPrice}`, inline: false }
            )
            .setTimestamp();

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | جديد`, embeds: [embed] });
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false });
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server running on port ${port}`));
