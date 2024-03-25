const { ButtonBuilder, ActionRowBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');

module.exports = {
	async submitRecord(event) {
		// Record submitting //
			const { db, client } = require('../index.js');
			const { enablePriorityRole, enableSeparateStaffServer, pendingRecordsID, priorityRecordsID, guildId, staffGuildId } = require('../config.json');

			if (event.action == 'create') {

				const levelname = event.record.expand.level.name;
				const submitter = event.record.expand.submitted_by.global_name;
				const device = (event.record.mobile ? 'Mobile': 'PC');
				const ldm = (event.record.ldm_id == 0 ? 'None': `${event.record.ldm_id}`);
				const video_url = event.record.video_url;
				const raw_url = (event.record.raw_footage == '' ? 'None' : event.record.raw_footage);
				const pb_id = event.record.id;
				const is_priority = event.record.priority;


				// Create accept/deny buttons
				const accept = new ButtonBuilder()
					.setCustomId('accept')
					.setLabel('Accept')
					.setStyle(ButtonStyle.Success);

				const deny = new ButtonBuilder()
					.setCustomId('deny')
					.setLabel('Deny')
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder()
					.addComponents(accept)
					.addComponents(deny);

				// Embed with record data to send in pending-record-log
				const recordEmbed = new EmbedBuilder()
					.setColor(0x005c91)
					.setTitle(levelname)
					.setDescription('Unassigned')
					.addFields(
						{ name: 'Record holder', value: submitter },
						{ name: 'Device', value: device, inline: true },
						{ name: 'LDM', value: ldm, inline: true },
						{ name: 'Completion link', value: video_url },
						{ name: 'Raw link', value: raw_url },
						{ name: 'Additional Info', value: 'None' },
					)
					.setTimestamp();

				// Send message
				const guild = await client.guilds.fetch((enableSeparateStaffServer ? staffGuildId : guildId));
				const sent = await guild.channels.cache.get((enablePriorityRole && is_priority ? priorityRecordsID : pendingRecordsID)).send({ embeds: [recordEmbed] });
				const sentvideo = await guild.channels.cache.get((enablePriorityRole && is_priority ? priorityRecordsID : pendingRecordsID)).send({ content : video_url, components: [row] });

				// Add record to sqlite db
				try {
					await db.dbPendingRecords.create({
						username: submitter,
						levelname: levelname,
						device: device,
						completionlink: video_url,
						raw: raw_url,
						ldm: ldm,
						additionalnotes: 'None',
						discordid: sentvideo.id,
						embedDiscordid: sent.id,
						priority: enablePriorityRole && is_priority,
						assigned: 'None',
						pocketbaseId: pb_id,
					});
				} catch (error) {
					console.log(`Couldn't register the record ; something went wrong with Sequelize : ${error}`);
					await sent.delete();
					await sentvideo.delete();
				}

				if (!(await db.dailyStats.findOne({ where: { date: Date.now() } }))) db.dailyStats.create({ date: Date.now(), nbRecordsSubmitted: 1, nbRecordsPending: await db.dbPendingRecords.count() });
				else await db.dailyStats.update({ nbRecordsSubmitted: (await db.dailyStats.findOne({ where: { date: Date.now() } })).nbRecordsSubmitted + 1 }, { where: { date: Date.now() } });

				console.log(`${submitter} submitted ${levelname}`);
			}
	}
};