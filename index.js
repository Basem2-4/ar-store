const { 
    Client, GatewayIntentBits, EmbedBuilder, ChannelType, 
    PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder 
} = require('discord.js');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors()); 
app.use(express.json());

// الاتصال بقاعدة البيانات (تم تركه كما هو)
mongoose.connect(process.env.MONGO_URI).catch(err => console.error("MongoDB Error:", err));

const StoreSchema = new mongoose.Schema({ configId: String, products: Array, customBgs: Object });
const Store = mongoose.model('Store', StoreSchema);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// --- المسار السريع لفتح التذكرة ---
app.post('/open-ticket', async (req, res) => {
    // 1. رد فوراً على الموقع لإنهاء الانتظار تماماً
    res.status(200).json({ success: true });

    // 2. البدء في إنشاء التذكرة في الخلفية دون تعطيل الاستجابة
    (async () => {
        try {
            const { productName, buyerId, qty, total, usage } = req.body;
            const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
            
            // جلب العضو من الكاش (أسرع شيء)
            let member = guild.members.cache.get(buyerId.toString().trim());
            if (!member) {
                member = await guild.members.fetch(buyerId.toString().trim()).catch(() => null);
            }
            if (!member) return console.log("Member not found");

            // إنشاء القناة مباشرة
            const channel = await guild.channels.create({
                name: `ticket-${member.user.username}`,
                type: ChannelType.GuildText,
                parent: CATEGORY_ID,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle('🛒 طلب شراء جديد')
                .setColor('#D4AF37')
                .addFields(
                    { name: '👤 المشتري', value: `<@${member.id}>`, inline: true },
                    { name: '📦 المنتج', value: productName, inline: true },
                    { name: '🔢 الكمية', value: qty.toString(), inline: true },
                    { name: '💰 الإجمالي', value: `${total} SR`, inline: true }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ 
                content: `مرحباً <@${member.id}> | <@&${ADMIN_ROLE_ID}>`, 
                embeds: [ticketEmbed], 
                components: [row] 
            });

        } catch (err) {
            console.error("Delayed Ticket Error:", err);
        }
    })(); 
});

// --- حل مشكلة تعليق زر الإغلاق (Unknown Interaction) ---
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;

    if (i.customId === 'close_ticket') {
        try {
            // الرد بـ deferUpdate يخبر ديسكورد أننا استلمنا الأمر فوراً ولن نحتاج لرد لاحقاً
            await i.deferUpdate(); 
            
            await i.channel.send("🔒 سيتم حذف القناة الآن...");
            
            // حذف القناة فوراً دون تأخير طويل
            setTimeout(() => i.channel.delete().catch(() => {}), 1000);
        } catch (error) {
            console.error("Close Error:", error);
        }
    }
});

client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`Fast Server on ${port}`));
