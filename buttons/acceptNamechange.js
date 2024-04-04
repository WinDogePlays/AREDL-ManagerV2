const { EmbedBuilder } = require('discord.js');

const { requestsArchivesId, enableSeparateStaffServer, guildId, staffGuildId } = require('../config.json');
const { db, pb } = require('../index.js');
const { getRegisteredKey } = require('../utils.js');

module.exports = {
	customId: 'acceptNamechange',
	ephemeral: true,
	async execute(interaction) {

		const request = await db.nameRequests.findOne({ where: { discordid: interaction.message.id } });
		if (!request) {
			await interaction.editReply(':x: Couldn\'t find a request linked to that discord message ID');
			try {
				await interaction.message.delete();
			} catch (error) {
				console.log(error);
			}
			return;
		}
		const key = await getRegisteredKey(interaction);
		if (key==-1) return;

		try {
			await pb.send(`/api/name-change-requests/${request.pb_id}/accept`, {
				method: 'POST',
				headers: {
					'api-key': key
				}
			});
		} catch (error) {
			if (error.status == 403) return await interaction.editReply(':x: You do not have the permission to accept name change requests');
			else return await interaction.editReply(`:x: Something went wrong while accepting this request :\n${JSON.stringify(error.response)}`);
		}

		const acceptEmbed = new EmbedBuilder()
			.setColor(0x8fce00)
			.setTitle(':white_check_mark: Name change Request')
			.addFields(
				{ name: 'Request accepted by', value: `${interaction.user}` },
				{ name: 'User\n(Global name):', value: request.user, inline: true},
				{ name: 'User\n(Discord):', value: request.user_discord, inline: true },
				{ name: '\t', value: '\t' },
				{ name: 'New name:', value: request.new_name, inline: true },
			)
			.setTimestamp();


		try {
			await interaction.message.delete();
		} catch (error) {
			await interaction.editReply(':x: The request has already been accepted/rejected, or something went wrong while deleting the message from pending');
			console.log(error);
			return;
		}

		const guild = await interaction.client.guilds.fetch(enableSeparateStaffServer ? staffGuildId : guildId);
		await guild.channels.cache.get(requestsArchivesId).send({ embeds: [acceptEmbed] });

		await db.mergeRequests.destroy({ where: { discordid: request.discordid } });

		console.log(`${interaction.user.tag} (${interaction.user.id}) accepted name change request from ${request.user} (${request.user_discord}) to ${request.new_name}`);

		return await interaction.editReply(':white_check_mark: The request has been accepted');

	},
};