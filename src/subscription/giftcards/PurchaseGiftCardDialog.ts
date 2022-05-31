import m, {Children, Component, Vnode} from "mithril"
import stream from "mithril/stream"
import Stream from "mithril/stream"
import {Dialog} from "../../gui/base/Dialog"
import {logins} from "../../api/main/LoginController"
import type {AccountingInfo, GiftCardOption} from "../../api/entities/sys/TypeRefs.js"
import {GiftCardTypeRef} from "../../api/entities/sys/TypeRefs.js"
import {showProgressDialog} from "../../gui/dialogs/ProgressDialog"
import {locator} from "../../api/main/MainLocator"
import type {Country} from "../../api/common/CountryList"
import {getByAbbreviation} from "../../api/common/CountryList"
import {BuyOptionBox} from "../BuyOptionBox"
import {ButtonN, ButtonType} from "../../gui/base/ButtonN"
import type {SubscriptionData, SubscriptionOptions, SubscriptionPlanPrices} from "../SubscriptionUtils"
import {getPreconditionFailedPaymentMsg, SubscriptionType, UpgradePriceType} from "../SubscriptionUtils"
import {renderAcceptGiftCardTermsCheckbox, showGiftCardToShare} from "./GiftCardUtils"
import type {DialogHeaderBarAttrs} from "../../gui/base/DialogHeaderBar"
import {showUserError} from "../../misc/ErrorHandlerImpl"
import {UserError} from "../../api/main/UserError"
import {Keys, PaymentMethodType} from "../../api/common/TutanotaConstants"
import {lang} from "../../misc/LanguageViewModel"
import {BadGatewayError, PreconditionFailedError} from "../../api/common/error/RestError"
import {loadUpgradePrices} from "../UpgradeSubscriptionWizard"
import {Icons} from "../../gui/base/icons/Icons"
import {Icon} from "../../gui/base/Icon"
import {GiftCardMessageEditorField} from "./GiftCardMessageEditorField"
import {client} from "../../misc/ClientDetector"
import type {lazy} from "@tutao/tutanota-utils"
import {filterInt, noOp, ofClass} from "@tutao/tutanota-utils"
import {isIOSApp} from "../../api/common/Env"
import {formatPrice, getSubscriptionPrice} from "../PriceUtils"
import {GiftCardService} from "../../api/entities/sys/Services"

export type GiftCardPurchaseViewAttrs = {
	purchaseLimit: number
	purchasePeriodMonths: number
	availablePackages: Array<GiftCardOption>
	initiallySelectedPackage: number
	message: string
	country: Country | null
	outerDialog: lazy<Dialog>
	premiumPrice: number
}

class GiftCardPurchaseView implements Component<GiftCardPurchaseViewAttrs> {
	message: Stream<string>
	selectedPackage: Stream<number>
	selectedCountry: Stream<Country | null>
	isConfirmed: Stream<boolean>

	constructor(vnode: Vnode<GiftCardPurchaseViewAttrs>) {
		const a = vnode.attrs
		this.selectedPackage = stream(a.initiallySelectedPackage)
		this.selectedCountry = stream(a.country)
		this.message = stream(a.message)
		this.isConfirmed = stream<boolean>(false)
	}

	view(vnode: Vnode<GiftCardPurchaseViewAttrs>): Children {
		const a = vnode.attrs
		return [
			m(
				".flex.center-horizontally.wrap",
				a.availablePackages.map((option, index) => {
					const value = parseFloat(option.value)
					const withSubscriptionAmount = value - a.premiumPrice
					return m(BuyOptionBox, {
						heading: m(
							".flex-center",
							Array(Math.pow(2, index)).fill(
								m(Icon, {
									icon: Icons.Gift,
									large: true,
								}),
							),
						),
						actionButton: () => {
							return {
								label: "pricing.select_action",
								click: () => {
									this.selectedPackage(index)
								},
								type: ButtonType.Login,
							} as const
						},
						price: formatPrice(value, true),
						helpLabel: () =>
							lang.get(withSubscriptionAmount === 0 ? "giftCardOptionTextA_msg" : "giftCardOptionTextB_msg", {
								"{remainingCredit}": formatPrice(withSubscriptionAmount, true),
								"{fullCredit}": formatPrice(value, true),
							}),
						features: () => [],
						width: 230,
						height: 250,
						paymentInterval: null,
						highlighted: this.selectedPackage() === index,
						showReferenceDiscount: false,
					})
				}),
			),
			m(
				".flex-center",
				m(GiftCardMessageEditorField, {
					message: this.message,
				}),
			),
			m(
				".flex-center",
				m(".flex-grow-shrink-auto.max-width-m.pt.pb.plr-l", [
					m(".pt", renderAcceptGiftCardTermsCheckbox(this.isConfirmed)),
					m(
						".mt-l.mb-l",
						m(ButtonN, {
							label: "buy_action",
							click: () => this.buyButtonPressed(a),
							type: ButtonType.Login,
						}),
					),
				]),
			),
		]
	}

	buyButtonPressed(attrs: GiftCardPurchaseViewAttrs) {
		if (!this.isConfirmed()) {
			Dialog.message("termsAcceptedNeutral_msg")
			return
		}

		const value = attrs.availablePackages[this.selectedPackage()].value
		// replace multiple new lines
		const message = this.message()
		const country = this.selectedCountry()

		if (!country) {
			Dialog.message("selectRecipientCountry_msg")
			return
		}

		showProgressDialog(
			"loading_msg",
			locator.giftCardFacade
				   .generateGiftCard(message, value, country.a)
				   .then(createdGiftCardId => locator.entityClient.load(GiftCardTypeRef, createdGiftCardId)),
		)
			.then(giftCard => {
				attrs.outerDialog().close()
				showGiftCardToShare(giftCard)
			})
			.catch(
				ofClass(PreconditionFailedError, e => {
					const message = e.data

					if (message && message.startsWith("giftcard")) {
						switch (message) {
							case "giftcard.limitreached":
								throw new UserError(() =>
									lang.get("tooManyGiftCards_msg", {
										"{amount}": `${attrs.purchaseLimit}`,
										"{period}": `${attrs.purchasePeriodMonths} months`,
									}),
								)

							case "giftcard.noaccountinginfo":
								throw new UserError("providePaymentDetails_msg")

							case "giftcard.invalidpaymentmethod":
								throw new UserError("invalidGiftCardPaymentMethod_msg")
						}
					} else {
						throw new UserError(getPreconditionFailedPaymentMsg(e.data))
					}
				}),
			)
			.catch(
				ofClass(BadGatewayError, e => {
					throw new UserError("paymentProviderNotAvailableError_msg")
				}),
			)
			.catch(ofClass(UserError, showUserError))
	}
}

/**
 * Create a dialog to buy a giftcard or show error if the user cannot do so
 * @returns {Promise<unknown>|Promise<void>|Promise<Promise<void>>}
 */

export function showPurchaseGiftCardDialog(): Promise<void> {
	if (isIOSApp()) {
		Dialog.message("notAvailableInApp_msg")
		return Promise.resolve()
	}

	const loadDialogPromise = logins
		.getUserController()
		.loadAccountingInfo()
		.then(accountingInfo => {
			// Only allow purchase with supported payment methods
			if (
				!accountingInfo ||
				accountingInfo.paymentMethod === PaymentMethodType.Invoice ||
				accountingInfo.paymentMethod === PaymentMethodType.AccountBalance
			) {
				throw new UserError("invalidGiftCardPaymentMethod_msg")
			}
		})
		.then(() =>
			Promise.all([
				locator.serviceExecutor.get(GiftCardService, null),
				logins.getUserController().loadCustomerInfo(),
				loadUpgradePrices(null), // do not pass in any campaign here because the gift card prices should be based on default prices.
			]),
		)
		.then(([giftCardInfo, customerInfo, prices]) => {
			// User can't buy too many gift cards so we have to load their giftcards in order to check how many they ordered
			const loadGiftCardsPromise = customerInfo.giftCards
				? locator.entityClient.loadAll(GiftCardTypeRef, customerInfo.giftCards.items)
				: Promise.resolve([])
			return loadGiftCardsPromise.then(existingGiftCards => {
				const sixMonthsAgo = new Date()
				sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - parseInt(giftCardInfo.period))
				const numPurchasedGiftCards = existingGiftCards.filter(giftCard => giftCard.orderDate > sixMonthsAgo).length

				if (numPurchasedGiftCards >= parseInt(giftCardInfo.maxPerPeriod)) {
					throw new UserError(() =>
						lang.get("tooManyGiftCards_msg", {
							"{amount}": giftCardInfo.maxPerPeriod,
							"{period}": `${giftCardInfo.period} months`,
						}),
					)
				}

				return logins
					.getUserController()
					.loadAccountingInfo()
					.then((accountingInfo: AccountingInfo) => {
						const priceData: SubscriptionPlanPrices = {
							Premium: prices.premiumPrices,
							PremiumBusiness: prices.premiumBusinessPrices,
							Teams: prices.teamsPrices,
							TeamsBusiness: prices.teamsBusinessPrices,
							Pro: prices.proPrices,
						}
						const subscriptionData: SubscriptionData = {
							options: {
								businessUse: () => false,
								paymentInterval: () => 12,
							} as SubscriptionOptions,
							planPrices: priceData,
						}
						let dialog: Dialog
						const attrs: GiftCardPurchaseViewAttrs = {
							purchaseLimit: filterInt(giftCardInfo.maxPerPeriod),
							purchasePeriodMonths: filterInt(giftCardInfo.period),
							availablePackages: giftCardInfo.options,
							initiallySelectedPackage: Math.floor(giftCardInfo.options.length / 2),
							message: lang.get("defaultGiftCardMessage_msg"),
							country: accountingInfo.invoiceCountry ? getByAbbreviation(accountingInfo.invoiceCountry) : null,
							outerDialog: () => dialog,
							premiumPrice: getSubscriptionPrice(subscriptionData, SubscriptionType.Premium, UpgradePriceType.PlanActualPrice),
						}
						const headerBarAttrs: DialogHeaderBarAttrs = {
							left: [
								{
									label: "close_alt",
									type: ButtonType.Secondary,
									click: () => dialog.close(),
								},
							],
							middle: () => lang.get("buyGiftCard_label"),
						}
						dialog = Dialog.largeDialogN(headerBarAttrs, GiftCardPurchaseView, attrs).addShortcut({
							key: Keys.ESC,
							exec: () => dialog.close(),
							help: "close_alt",
						})

						if (client.isMobileDevice()) {
							// Prevent focusing text field automatically on mobile. It opens keyboard and you don't see all details.
							dialog.setFocusOnLoadFunction(noOp)
						}

						return dialog
					})
			})
		})
	return showProgressDialog("loading_msg", loadDialogPromise)
		.then(dialog => {
			dialog && dialog.show()
		})
		.catch(ofClass(UserError, showUserError))
}