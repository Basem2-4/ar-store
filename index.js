const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// قراءة البيانات من إعدادات Environment في Render
const TOKEN = process.env.TOKEN; 
const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // إنشاء التذكرة
        // تحديث جزء إنشاء القناة في ملف index.js
const channel = await guild.channels.create({
    name: `طلب-${buyerId}`,
    type: ChannelType.GuildText,
    parent: CATEGORY_ID,
    permissionOverwrites: [
        { 
            id: guild.id, 
            deny: [PermissionFlagsBits.ViewChannel] 
        },
        { 
            id: buyerId.toString().trim(), // التأكد من تنظيف الايدي
            allow: [
                PermissionFlagsBits.ViewChannel, 
                PermissionFlagsBits.SendMessages, 
                PermissionFlagsBits.ReadMessageHistory
            ] 
        },
    ],
});

        const embed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد من المتجر')
            .setColor('#D4AF37')
            .addFields(
                { name: 'المنتج', value: productName, inline: true },
                { name: 'الكمية', value: qty.toString(), inline: true },
                { name: 'الإجمالي', value: `${total} SR`, inline: true },
                { name: 'نوع الطلب', value: usage, inline: true },
                { name: 'المشتري', value: `<@${buyerId}>` }
            )
            .setTimestamp();

        await channel.send({ content: `مرحباً <@${buyerId}>، فريق الدعم معك الآن لتنفيذ طلبك.`, embeds: [embed] });
        
        res.json({ success: true, url: `https://discord.com/channels/${GUILD_ID}/${channel.id}` });
    } catch (error) {
        console.error("خطأ:", error);
        res.status(500).json({ success: false, error: "فشل في إنشاء التذكرة" });
    }
});

client.once('ready', () => {
    console.log(`✅ البوت جاهز ومسجل باسم: ${client.user.tag}`);
});

const PORT = process.env.PORT || 10000; // تغيير المنفذ إلى 10000 ليتوافق مع Render
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT} وجاهز للربط الخارجي`);
});

client.login(TOKEN);




