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

const Counter = mongoose.model('Counter', new mongoose.Schema({ id: String, seq: Number }));

// 2. إعداد البوت
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// 3. مسار إنشاء التذكرة
app.post('/api/create-ticket', async (req, res) => {
    // طباعة البيانات في الكونسول لمعرفة المسميات الصحيحة من موقعك
    console.log('--- بيانات قادمة من المتجر ---');
    console.log(JSON.stringify(req.body, null, 2));
    
    const data = req.body;

    // محاولة استخراج اسم المنتج من عدة احتمالات (بما فيها الأنظمة المعقدة)
    let productName = data.productName || data.item || data.product || data.title || data.itemName || "غير معروف";
    let quantity = data.quantity || data.qty || 1;

    // إذا كانت البيانات داخل مصفوفة (مثل سلة أو زد)
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        productName = data.items.map(i => i.name || i.product_name || i.title || "منتج").join(', ');
        quantity = data.items[0].quantity || data.items[0].qty || quantity;
    } else if (data.products && Array.isArray(data.products)) {
        productName = data.products.map(p => p.name || p.title).join(', ');
    }

    const discordId = data.discordId || data.userId || data.user_id || data.customer_id;
    const totalPrice = data.totalPrice || data.price || data.total || '0';
    const categoryName = data.categoryName || data.category || 'عام';

    if (!discordId) return res.status(400).json({ success: false, error: 'Discord ID missing' });

    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        // تنفيذ العداد وجلب العضو بالتوازي للسرعة
        const [orderId, member] = await Promise.all([
            Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).then(d => d.seq),
            guild.members.fetch(discordId.trim()).catch(() => null)
        ]);

        if (!member) return res.status(404).json({ success: false, error: 'User not found' });

        // إنشاء القناة
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

        // الرد الفوري للموقع ليكون أسرع شيء
        res.status(200).json({ success: true, channelId: channel.id });

        // إرسال الإمبد في الخلفية
        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${member.id}>\nتم فتح هذه التذكرة لمتابعة طلبك مع الإدارة.`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'قسم الطلب', value: `${categoryName}`, inline: true },
                { name: 'التفاصيل', value: `${productName} النسخ ${quantity}`, inline: false },
                { name: 'الإجمالي', value: `${totalPrice}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, embeds: [embed] });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (!res.headersSent) res.status(500).json({ success: false });
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server on port ${port}`));
