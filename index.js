const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// تعريف البوت مع الصلاحيات اللازمة (تأكد من تفعيلها في Discord Developer Portal)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // ضروري لجلب بيانات العضو
        GatewayIntentBits.MessageContent
    ]
});

// قراءة البيانات من إعدادات البيئة (Environment) في Render
const TOKEN = process.env.TOKEN; 
const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        
        // جلب السيرفر
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // الخطوة الأهم: جلب العضو من السيرفر للتأكد من وجوده وحل مشكلة InvalidType
        let member;
        try {
            member = await guild.members.fetch(buyerId.toString().trim());
        } catch (e) {
            console.error("Member not found:", buyerId);
            return res.status(400).json({ 
                success: false, 
                error: "لم يتم العثور على حسابك في السيرفر. تأكد من دخولك للسيرفر أولاً." 
            });
        }

        // إنشاء التذكرة (قناة نصية)
        const channel = await guild.channels.create({
            name: `طلب-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { 
                    id: guild.id, 
                    deny: [PermissionFlagsBits.ViewChannel] 
                },
                { 
                    id: member.id, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages, 
                        PermissionFlagsBits.ReadMessageHistory
                    ] 
                },
            ],
        });

        // إنشاء رسالة الترحيب والبيانات (Embed)
        const embed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد من المتجر')
            .setColor('#D4AF37')
            .addFields(
                { name: 'المنتج', value: productName, inline: true },
                { name: 'الكمية', value: qty.toString(), inline: true },
                { name: 'الإجمالي', value: `${total} SR`, inline: true },
                { name: 'نوع الطلب', value: usage || 'غير محدد', inline: true },
                { name: 'المشتري', value: `<@${member.id}>` }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        // إرسال الرسالة داخل التذكرة
        await channel.send({ 
            content: `مرحباً <@${member.id}>، فريق الدعم معك الآن لتنفيذ طلبك.`, 
            embeds: [embed] 
        });
        
        // إرسال استجابة نجاح للموقع
        res.json({ 
            success: true, 
            url: `https://discord.com/channels/${GUILD_ID}/${channel.id}` 
        });

    } catch (error) {
        console.error("خطأ داخلي:", error);
        res.status(500).json({ 
            success: false, 
            error: "فشل في إنشاء التذكرة: " + error.message 
        });
    }
});

client.once('ready', () => {
    console.log(`✅ البوت جاهز ومسجل باسم: ${client.user.tag}`);
});

// إعداد المنفذ ليتوافق مع Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
});

client.login(TOKEN);
