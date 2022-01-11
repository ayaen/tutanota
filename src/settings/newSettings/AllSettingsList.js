//@flow
import m from "mithril"
import {assertMainOrNode} from "../../api/common/Env"
import type {SettingsSection} from "./SettingsModel"
import {SettingsModel} from "./SettingsModel"
import type {SettingsSelectListAttrs} from "./SettingsSelectList"
import {SettingsSelectList} from "./SettingsSelectList"

assertMainOrNode()

export type AllSettingsListAttrs = {
	model: SettingsModel
}

export class AllSettingsList implements MComponent<AllSettingsListAttrs> {

	sectionsList: Array<SettingsSection>

	view(vnode: Vnode<AllSettingsListAttrs>): Children {
		const {model} = vnode.attrs
		const settingSelectListAttrs: SettingsSelectListAttrs<SettingsSection> = {
			items: model.sections,
			selectedItem: model.selectedSection,
			emptyListMessage: "emptyList_msg",
			renderItem: (setting) => m(SettingsRow, {settingObject: setting})
		}
		return m(SettingsSelectList, settingSelectListAttrs)
	}
}

type SettingsRowAttrs = {
	settingObject: SettingsSection
}

export class SettingsRow implements MComponent<SettingsRowAttrs> {
	view(vnode: Vnode<SettingsRowAttrs>): Children {
		const {heading, category} = vnode.attrs.settingObject
		return [
			m(".top", [
				m(".name", heading)
			]),
			m(".bottom.flex-space-between", [
				m("small.mail-address", category)
			])
		]
	}
}
