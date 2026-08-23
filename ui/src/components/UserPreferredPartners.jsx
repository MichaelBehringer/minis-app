import { Select } from "antd";
import { useEffect, useState } from "react";
import { doGetRequestAuth, doPatchRequestAuth } from "../helper/RequestHelper";
import { myToastSuccess, myToastError, myToastInfo } from "../helper/ToastHelper";

const MAX_PARTNER = 3;

export default function UserPreferredPartners({ userId, token }) {
    const [allUsers, setAllUsers] = useState([]);
    const [preferred, setPreferred] = useState([]);

    useEffect(() => {
        async function load() {
            const all = await doGetRequestAuth("userHead", token);
            const pref = await doGetRequestAuth(`user/${userId}/preferred`, token);

            setAllUsers(all.data);
            if (pref.data) {
                setPreferred(pref.data);
            }
        }
        load();
    }, [userId, token]);

    const handleChange = async (newList) => {
        if (newList.length > MAX_PARTNER) {
            myToastInfo(`Maximal ${MAX_PARTNER} erlaubt`);
            return;
        }

        // Herausfinden, welcher Wert sich geaendert hat - der Server nimmt
        // einzelne Aenderungen, nicht die ganze Liste.
        const oldList = preferred;
        const add = newList.length > oldList.length;
        const changedId = add
            ? newList.find((id) => !oldList.includes(id))
            : oldList.find((id) => !newList.includes(id));

        // Sofort anzeigen, damit das Antippen nicht auf den Server wartet.
        setPreferred(newList);

        try {
            await doPatchRequestAuth(`user/${userId}/preferred`, {
                otherUserId: changedId,
                add
            }, token);
            myToastSuccess(add ? "Hinzugefügt" : "Entfernt");
        } catch {
            // Ohne diesen Zweig blieb die Anzeige auf dem neuen Stand stehen,
            // obwohl der Server nichts gespeichert hat.
            setPreferred(oldList);
            myToastError("Änderung konnte nicht gespeichert werden");
        }
    };

    // options-Prop statt Select.Option-Children: die Children-Schreibweise ist
    // in antd 6 nicht mehr vorgesehen.
    const options = allUsers
        .filter((u) => u.id !== userId)
        .map((u) => ({
            value: u.id,
            label: `${u.firstname} ${u.lastname}`,
        }));

    return (
        <div>
            <Select
                mode="multiple"
                style={{ width: "100%" }}
                placeholder="Ministranten auswählen"
                aria-label="Wunschpartner"
                value={preferred}
                onChange={handleChange}
                options={options}
                maxTagCount={MAX_PARTNER}
                showSearch
                filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
            />
        </div>
    );
}
