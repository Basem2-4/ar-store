const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. الاتصال بقاعدة البيانات وإعداد نظام عداد الطلبات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB ✅'))
    .catch(err => console.error('MongoDB Connection Error ❌', err));

const counterSchema = new mongoose.Schema({ id: String, seq: Number });
const Counter = mongoose.model('Counter', counterSchema);

const getNextSequenceValue = async (sequenceName) => {
    const sequenceDocument = await Counter.findOneAndUpdate(
        { id: sequenceName },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.seq;
};

// 2. إعداد البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835949405503591"; // تأكد من وضع ايدي روم اللوق الصحيح هنا
const ADMIN_ROLE_ID = "1433835499918983218"; 

// 3. مسار إنشاء التذكرة
app.post('/api/create-ticket', async (req, res) => {
    // تم إضافة categoryName و productName لاستلامها من الموقع
    const { discordId, orderDetails, totalPrice, categoryName, productName } = req.body;

    if (!discordId || discordId === 'undefined') {
        return res.status(400).json({ success: false, error: 'Discord ID is missing' });
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId.trim());
        
        // الحصول على رقم الطلب المتتالي
        const orderId = await getNextSequenceValue("orderId");

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

        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('إغلاق التذكرة')
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${member.id}>\nتم فتح هذه التذكرة لمتابعة طلبك مع الإدارة.`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'القسم', value: `${categoryName || 'غير محدد'}`, inline: true },
                { name: 'المنتج', value: `${productName || 'غير محدد'}`, inline: true },
                { name: 'الإجمالي', value: `${totalPrice || '0'}`, inline: false },
                { name: 'تفاصيل إضافية', value: orderDetails || 'لا توجد تفاصيل' }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, 
            embeds: [embed],
            components: [closeButton]
        });

        res.status(200).json({ success: true, channelId: channel.id });

    } catch (error) {
        console.error('❌ خطأ أثناء إنشاء التذكرة:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// 4. نظام التعامل مع الأزرار (إغلاق التذكرة)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket') {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        
        const logEmbed = new EmbedBuilder()
            .setTitle('🔒 تذكرة مغلقة')
            .setColor('#ff0000')
            .addFields(
                { name: 'اسم التذكرة', value: `${interaction.channel.name}`, inline: true },
                { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        if (logChannel) await logChannel.send({ embeds: [logEmbed] });

        await interaction.reply('سيتم إغلاق التذكرة خلال 5 ثوانٍ...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
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
