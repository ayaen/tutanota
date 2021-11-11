// @flow
import m from "mithril"
import {TextFieldN, Type} from "../gui/base/TextFieldN"
import {PasswordIndicator} from "../gui/PasswordIndicator"
import {getPasswordStrength, isSecurePassword} from "../misc/passwords/PasswordUtils"
import {Dialog} from "../gui/base/Dialog"
import type {TranslationKey} from "../misc/LanguageViewModel"
import {lang} from "../misc/LanguageViewModel"
import type {Status} from "../gui/base/StatusField"
import {StatusField} from "../gui/base/StatusField"
import stream from "mithril/stream/stream.js"
import {logins} from "../api/main/LoginController"
import {NotAuthenticatedError} from "../api/common/error/RestError"
import {showProgressDialog} from "../gui/dialogs/ProgressDialog"
import type {User} from "../api/entities/sys/User"
import {getEnabledMailAddressesForGroupInfo} from "../api/common/utils/GroupUtils";
import {ofClass} from "@tutao/tutanota-utils"
import {getEtId} from "../api/common/utils/EntityUtils"
import {locator} from "../api/main/MainLocator"
import {assertMainOrNode} from "../api/common/Env"
import {showPasswordGeneratorDialog} from "../misc/passwords/PasswordGeneratorDialog"
import {Icons} from "../gui/base/icons/Icons"
import {Icon} from "../gui/base/Icon"
import {theme} from "../gui/theme"
import {px} from "../gui/size"

assertMainOrNode()

/**
 * A form for entering a new password. Optionally it allows to enter the old password for validation and/or to repeat the new password.
 * showChangeOwnPasswordDialog() and showChangeUserPasswordAsAdminDialog() show this form as dialog.
 */
export class PasswordForm {
	view: Function;
	_oldPassword: string
	_oldPasswordStatus: Status;
	_newPassword: string
	_newPasswordStatus: Status;
	_repeatedPassword: string
	_repeatedPasswordStatus: Status;
	_revealPassword: boolean

	_validateOldPassword: boolean
	_enforcePasswordStrength: boolean
	_repeatPassword: boolean

	constructor(validateOldPassword: boolean, enforcePasswordStrength: boolean, repeatPassword: boolean, passwordInfoTextId: ?TranslationKey) {
		this._validateOldPassword = validateOldPassword
		this._enforcePasswordStrength = enforcePasswordStrength
		this._repeatPassword = repeatPassword
		this._revealPassword = false

		// make sure both the input values and status fields are initialized correctly
		this._onOldPasswordInput("")
		this._onNewPasswordInput("")
		this._onRepeatedPasswordInput("")

		const oldPasswordFieldAttrs = {
			label: "oldPassword_label",
			value: stream(this._oldPassword),
			helpLabel: () => m(StatusField, {status: this._oldPasswordStatus}),
			oninput: (value) => this._onOldPasswordInput(value),
			preventAutoFill: true,
			type: Type.Password,
		}

		const passwordIndicator = new PasswordIndicator(() => this._getPasswordStrength())


		const repeatedPasswordFieldAttrs = {
			label: "repeatedPassword_label",
			value: stream(this._repeatedPassword),
			helpLabel: () => m(StatusField, {status: this._repeatedPasswordStatus}),
			oninput: (value) => this._onRepeatedPasswordInput(value),
			type: Type.Password,
		}

		this.view = () => {
			const newPasswordFieldAttrs = {
				label: "newPassword_label",
				value: () => this._newPassword,
				helpLabel: () => m("", [
					m(StatusField, {status: this._newPasswordStatus}),
					this.renderPasswordGeneratorHelp()
				]),
				oninput: (value) => this._onNewPasswordInput(value),
				type: this._revealPassword ? Type.Text : Type.Password,
				preventAutofill: true,
				injectionsRight: () => [
					this.renderRevealIcon(),
					m(".mb-s.mlr", m(passwordIndicator))
				],
			}

			return m("", {
				onremove: () => {
					this._oldPassword = ""
					this._newPassword = ""
					this._repeatedPassword = ""
				}
			}, [
				(validateOldPassword) ? m(TextFieldN, oldPasswordFieldAttrs) : null,
				m(TextFieldN, newPasswordFieldAttrs),
				(passwordInfoTextId) ? m(".small.mt-s", lang.get(passwordInfoTextId)) : null,
				(repeatPassword) ? m(TextFieldN, repeatedPasswordFieldAttrs) : null
			])
		}
	}

	_getPasswordStrength(): number {
		let reserved = []
		if (logins.isUserLoggedIn()) {
			reserved = getEnabledMailAddressesForGroupInfo(logins.getUserController().userGroupInfo)
				.concat(logins.getUserController().userGroupInfo.name)
		}
		// 80% strength is minimum. we expand it to 100%, so the password indicator is completely filled when the password is strong enough
		return getPasswordStrength(this._newPassword, reserved)
	}

	_getErrorFromStatus(status: Status): ?TranslationKey {
		if (!status) return null

		return (status.type !== "valid") ? status.text : null
	}

	getErrorMessageId(): ?TranslationKey {
		return this._getErrorFromStatus(this._oldPasswordStatus)
			|| this._getErrorFromStatus(this._newPasswordStatus)
			|| this._getErrorFromStatus(this._repeatedPasswordStatus)
	}

	getOldPassword(): string {
		return this._oldPassword
	}

	getNewPassword(): string {
		return this._newPassword
	}

	isPasswordUnsecure(): boolean {
		return !isSecurePassword(this._getPasswordStrength())
	}

	/**
	 *  FIXME Looks super goofy right now
	 */
	renderPasswordGeneratorHelp(): Children {
		return m("", [
			m(".mr-xs", {style: {display: "inline-block"}}, "Having trouble creating a password?"),
			m(".b.mr-xs.hover.click.darkest-hover", {
				style: {display: "inline-block", color: theme.navigation_button_selected},
				onclick: async () => {
					this._onNewPasswordInput(await showPasswordGeneratorDialog())
					m.redraw()
				}
			}, "Generate"),
			m("", {style: {display: "inline-block"}}, "a passphrase!")
		])
	}

	renderRevealIcon(): Children {
		return m(".click.ml-s", {
			style: {paddingTop: px(4)}, // Needs to be exactly 4px as pt-xs is 3px and its 1px too high
			onclick: () => {
				this._revealPassword = !this._revealPassword
				m.redraw()
			}
		}, m(Icon, {
			icon: Icons.Eye,
			style: {opacity: this._revealPassword ? 0.4 : 1} // FIXME is there a better way to do this?
		}))
	}

	/**
	 * The user must enter the old password in addition to the new password (twice). The password strength is enforced.
	 */
	static showChangeOwnPasswordDialog(allowCancel: boolean = true): void {
		let form = new PasswordForm(true, true, true)
		let changeOwnPasswordOkAction = (dialog) => {
			let error = form.getErrorMessageId();
			if (error) {
				Dialog.message(error)
			} else {
				showProgressDialog("pleaseWait_msg",
					locator.loginFacade.changePassword(form.getOldPassword(), form.getNewPassword()))
					.then(() => {
						locator.credentialsProvider.deleteByUserId(getEtId(logins.getUserController().user))
						Dialog.message("pwChangeValid_msg")
						dialog.close()
					})
					.catch(ofClass(NotAuthenticatedError, e => {
						Dialog.message("oldPasswordInvalid_msg")
					}))
					.catch(e => {
						Dialog.message("passwordResetFailed_msg")
					})
			}
		}
		Dialog.showActionDialog({
			title: lang.get("changePassword_label"),
			child: form,
			validator: () => form.getErrorMessageId(),
			okAction: changeOwnPasswordOkAction,
			allowCancel: allowCancel
		})
	}

	/**
	 *The admin does not have to enter the old password in addition to the new password (twice). The password strength is not enforced.
	 */
	static showChangeUserPasswordAsAdminDialog(user: User): void {
		let form = new PasswordForm(false, false, true)
		let changeUserPasswordAsAdminOkAction = (dialog) => {
			let p = locator.userManagementFacade.changeUserPassword(user, form.getNewPassword()).then(() => {
				Dialog.message("pwChangeValid_msg")
				dialog.close()
			}).catch(e => {
				Dialog.message("passwordResetFailed_msg")
			})
			showProgressDialog("pleaseWait_msg", p)
		}

		Dialog.showActionDialog({
			title: lang.get("changePassword_label"),
			child: form,
			validator: () => form.getErrorMessageId(),
			okAction: changeUserPasswordAsAdminOkAction
		})
	}

	_onOldPasswordInput(oldPassword: string): void {
		this._oldPassword = oldPassword

		if (this._validateOldPassword && oldPassword === "") {
			this._oldPasswordStatus = {type: "neutral", text: "oldPasswordNeutral_msg"}
		} else {
			this._oldPasswordStatus = {type: "valid", text: "emptyString_msg"}
		}
	}

	_onNewPasswordInput(newPassword: string): void {
		this._newPassword = newPassword

		if (this._newPassword === "") {
			this._newPasswordStatus = {type: "neutral", text: "password1Neutral_msg"}
		} else if (this._validateOldPassword && this._oldPassword === this._newPassword) {
			this._newPasswordStatus = {type: "invalid", text: "password1InvalidSame_msg"}
		} else if (this.isPasswordUnsecure()) {
			if (this._enforcePasswordStrength) {
				this._newPasswordStatus = {type: "invalid", text: "password1InvalidUnsecure_msg"}
			} else {
				this._newPasswordStatus = {type: "valid", text: "password1InvalidUnsecure_msg"}
			}
		} else {
			this._newPasswordStatus = {type: "valid", text: "passwordValid_msg"}
		}
	}

	_onRepeatedPasswordInput(repeatedPassword: string): void {
		this._repeatedPassword = repeatedPassword

		if (this._repeatPassword && this._repeatedPassword === "") {
			this._repeatedPasswordStatus = {type: "neutral", text: "password2Neutral_msg"}
		} else if (this._repeatPassword && this._repeatedPassword !== this._newPassword) {
			this._repeatedPasswordStatus = {type: "invalid", text: "password2Invalid_msg"}
		} else {
			this._repeatedPasswordStatus = {type: "valid", text: "passwordValid_msg"}
		}
	}
}
