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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// إعدادات البيئة
const TOKEN = process.env.TOKEN; 
const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; // تأكد من وضع ايدي صحيح هنا

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        
        // 1. جلب السيرفر
        const guild = await client.guilds.fetch(GUILD_ID);
        
        // 2. التحقق من وجود العضو (المشتري)
        let member;
        try {
            member = await guild.members.fetch(buyerId.toString().trim());
        } catch (e) {
            return res.status(400).json({ success: false, error: "العضو غير موجود في السيرفر حالياً" });
        }

        // 3. التحقق من رتبة الإدارة (لمنع خطأ InvalidType)
        const adminRole = guild.roles.cache.get(ADMIN_ROLE_ID);
        const permissionOverwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ];

        // إضافة رتبة الإدارة فقط إذا كانت موجودة فعلياً في السيرفر
        if (adminRole) {
            permissionOverwrites.push({
                id: ADMIN_ROLE_ID,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
        }

        // 4. إنشاء القناة
        const channel = await guild.channels.create({
            name: `طلب-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID || null,
            permissionOverwrites: permissionOverwrites,
        });

        // 5. إرسال المحتوى
        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('إغلاق التذكرة')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const row = new ActionRowBuilder().addComponents(closeButton);

        const embed = new EmbedBuilder()
            .setTitle('🛒 تذكرة شراء جديدة')
            .setColor('#D4AF37')
            .addFields(
                { name: 'المنتج', value: productName, inline: true },
                { name: 'الكمية', value: qty.toString(), inline: true },
                { name: 'الإجمالي', value: `${total} SR`, inline: true },
                { name: 'المشتري', value: `<@${member.id}>` },
                { name: 'نوع الاستخدام', value: usage || 'غير محدد' }
            )
            .setFooter({ text: 'اضغط على الزر أدناه لإغلاق التذكرة' })
            .setTimestamp();

        const mentionContent = adminRole ? `<@&${ADMIN_ROLE_ID}>` : "@Admin";
        await channel.send({ 
            content: `إشعار: ${mentionContent} | تذكرة جديدة من <@${member.id}>`, 
            embeds: [embed],
            components: [row]
        });

        res.json({ success: true, url: `https://discord.com/channels/${GUILD_ID}/${channel.id}` });

    } catch (error) {
        console.error("خطأ في السيرفر:", error);
        res.status(500).json({ success: false, error: "حدث خطأ داخلي: " + error.message });
    }
});

// معالج الأزرار
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'close_ticket') {
        await interaction.reply('سيتم إغلاق التذكرة وحذف القناة خلال 5 ثوانٍ...');
        setTimeout(async () => {
            try { await interaction.channel.delete(); } 
            catch (err) { console.error("فشل حذف القناة:", err); }
        }, 5000);
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} يعمل الآن وجاهز لاستلام الطلبات`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
});

client.login(TOKEN);
