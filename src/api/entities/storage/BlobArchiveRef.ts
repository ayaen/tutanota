import {create} from "../../common/utils/EntityUtils.js"
import {TypeRef, downcast} from "@tutao/tutanota-utils"
import type {TypeModel} from "../../common/EntityTypes.js"


export const BlobArchiveRefTypeRef: TypeRef<BlobArchiveRef> = new TypeRef("storage", "BlobArchiveRef")
export const _TypeModel: TypeModel = {
	"name": "BlobArchiveRef",
	"since": 4,
	"type": "LIST_ELEMENT_TYPE",
	"id": 128,
	"rootId": "B3N0b3JhZ2UAAIA",
	"versioned": false,
	"encrypted": false,
	"values": {
		"_format": {
			"id": 132,
			"type": "Number",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		},
		"_id": {
			"id": 130,
			"type": "GeneratedId",
			"cardinality": "One",
			"final": true,
			"encrypted": false
		},
		"_ownerGroup": {
			"id": 133,
			"type": "GeneratedId",
			"cardinality": "ZeroOrOne",
			"final": true,
			"encrypted": false
		},
		"_permissions": {
			"id": 131,
			"type": "GeneratedId",
			"cardinality": "One",
			"final": true,
			"encrypted": false
		}
	},
	"associations": {
		"archive": {
			"id": 134,
			"type": "ELEMENT_ASSOCIATION",
			"cardinality": "One",
			"final": false,
			"refType": "Archive"
		}
	},
	"app": "storage",
	"version": "4"
}

export function createBlobArchiveRef(values?: Partial<BlobArchiveRef>): BlobArchiveRef {
	return Object.assign(create(_TypeModel, BlobArchiveRefTypeRef), downcast<BlobArchiveRef>(values))
}

export type BlobArchiveRef = {
	_type: TypeRef<BlobArchiveRef>;

	_format: NumberString;
	_id: IdTuple;
	_ownerGroup: null | Id;
	_permissions: Id;

	archive: Id;
}