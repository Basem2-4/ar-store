const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder 
} = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// تشغيل البوت مع الصلاحيات المطلوبة
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // ضروري لرؤية الأعضاء
        GatewayIntentBits.MessageContent
    ]
});

// الإعدادات - تأكد من وضع القيم في Render Environment Variables أو استبدلها هنا
const TOKEN = process.env.TOKEN; 
const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835382549774376"; // ايدي قناة اللوق (سجل التذاكر)
const ADMIN_ROLE_ID = "1433835382549774376"; // ايدي رتبة الإدارة لعمل منشن

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // محاولة جلب العضو للتأكد من وجوده في السيرفر
        let member;
        try {
            member = await guild.members.fetch(buyerId.toString().trim());
        } catch (e) {
            return res.status(400).json({ success: false, error: "العضو غير موجود في السيرفر" });
        }

        // 1. إنشاء قناة التذكرة الجديدة
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
                { 
                    id: ADMIN_ROLE_ID, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages
                    ] 
                }
            ],
        });

        // 2. إنشاء زر الإغلاق
        const closeBtn = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('إغلاق التذكرة')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const row = new ActionRowBuilder().addComponents(closeBtn);

        // 3. رسالة التذكرة (Embed)
        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 تفاصيل طلب الشراء')
            .setColor('#D4AF37') // لون ذهبي
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '👤 المشتري', value: `<@${member.id}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '🔢 الكمية', value: qty.toString(), inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true },
                { name: '📝 نوع الاستخدام', value: usage || 'غير محدد', inline: true }
            )
            .setFooter({ text: 'متجر AR - نظام التذاكر الآلي' })
            .setTimestamp();

        // إرسال الرسالة في القناة مع منشن الإدارة
        await channel.send({ 
            content: `تنبيه الإدارة: <@&${ADMIN_ROLE_ID}> | طلب جديد من <@${member.id}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

        // 4. إرسال سجل (Log) إلى قناة اللوق
        try {
            const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
            const logEmbed = new EmbedBuilder()
                .setTitle('📥 سجل إنشاء تذكرة')
                .setColor('#2ecc71') // أخضر
                .setDescription(`تم فتح تذكرة جديدة بواسطة <@${member.id}>`)
                .addFields(
                    { name: 'اسم القناة', value: `#${channel.name}` },
                    { name: 'المنتج', value: productName }
                )
                .setTimestamp();
            
            if (logChannel) await logChannel.send({ embeds: [logEmbed] });
        } catch (logErr) {
            console.error("فشل إرسال اللوق:", logErr.message);
        }

        res.json({ success: true, url: `https://discord.com/channels/${GUILD_ID}/${channel.id}` });

    } catch (error) {
        console.error("Internal Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// معالج زر إغلاق التذكرة
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket') {
        // إرسال رسالة تأكيد قبل الحذف
        await interaction.reply({ content: '⚠️ سيتم إغلاق التذكرة وحذف القناة بعد 5 ثوانٍ...' });
        
        // إرسال لوق الإغلاق (اختياري)
        console.log(`قناة ${interaction.channel.name} تم إغلاقها بواسطة ${interaction.user.tag}`);

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (err) {
                console.error("فشل في حذف القناة:", err);
            }
        }, 5000);
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} متصل وجاهز للعمل!`);
});

// منفذ السيرفر لـ Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
});

client.login(TOKEN);
