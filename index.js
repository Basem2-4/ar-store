const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    ComponentType 
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
const ADMIN_ROLE_ID = "1433835499918983218"; 

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        const guild = await client.guilds.fetch(GUILD_ID);
        
        let member;
        try {
            member = await guild.members.fetch(buyerId.toString().trim());
        } catch (e) {
            return res.status(400).json({ success: false, error: "لم يتم العثور على العضو" });
        }

        // إنشاء القناة
        const channel = await guild.channels.create({
            name: `طلب-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } // السماح للإدارة بالرؤية
            ],
        });

        // إنشاء زر الإغلاق
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
                { name: 'المشتري', value: `<@${member.id}>` }
            )
            .setFooter({ text: 'اضغط على الزر أدناه لإغلاق التذكرة' })
            .setTimestamp();

        // إرسال الرسالة مع منشن الإدارة والزر
        await channel.send({ 
            content: `منشن الإدارة: <@&${ADMIN_ROLE_ID}> | تذكرة جديدة من <@${member.id}>`, 
            embeds: [embed],
            components: [row]
        });

        res.json({ success: true, url: `https://discord.com/channels/${GUILD_ID}/${channel.id}` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// معالج الضغط على الأزرار
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket') {
        // التحقق مما إذا كان الشخص الذي ضغط هو إداري أو صاحب التذكرة (اختياري)
        await interaction.reply('سيتم إغلاق التذكرة وحذف القناة خلال 5 ثوانٍ...');
        
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (err) {
                console.error("فشل حذف القناة:", err);
            }
        }, 5000);
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} يعمل الآن`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر على المنفذ ${PORT}`);
});

client.login(TOKEN);
