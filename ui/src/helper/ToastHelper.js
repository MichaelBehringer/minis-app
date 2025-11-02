import { message } from "antd";

export function toastError(txt) {
	message.error(txt, 3);
}

export function toastSuccess(txt) {
	message.success(txt, 3);
}

	export function toastInfo(txt) {
		message.info(txt, 3);
}