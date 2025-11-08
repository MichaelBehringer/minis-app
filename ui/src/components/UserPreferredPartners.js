import { Select, message } from "antd";
import { useEffect, useState } from "react";
import { doGetRequestAuth, doPatchRequestAuth } from "../helper/RequestHelper";

export default function UserPreferredPartners({ userId, token }) {
    const [allUsers, setAllUsers] = useState([]);
    const [preferred, setPreferred] = useState([]);

    useEffect(() => {
        async function load() {
            const all = await doGetRequestAuth("user", token);
            const pref = await doGetRequestAuth(`user/${userId}/preferred`, token);

            setAllUsers(all.data);
            if (pref.data) {
                setPreferred(pref.data)

            }
        }
        load();
    }, [userId, token]);

    const handleChange = async (newList) => {
        // Limit auf 3 erzwingen
        if (newList.length > 3) {
            message.warning("Maximal 3 erlaubt");
            return;
        }

        // herausfinden, welcher Wert verändert wurde
        const oldList = preferred;

        let changedId = null;
        let add = false;

        if (newList.length > oldList.length) {
            // ein neuer User wurde hinzugefügt
            changedId = newList.find(id => !oldList.includes(id));
            add = true;
        } else {
            // ein User wurde entfernt
            changedId = oldList.find(id => !newList.includes(id));
            add = false;
        }

        // Sofort UI setzen:
        setPreferred(newList);

        // API Update senden
        await doPatchRequestAuth(`user/${userId}/preferred`, {
            otherUserId: changedId,
            add
        }, token);

        message.success(add ? "Hinzugefügt" : "Entfernt");
    };

    return (
        <div>
            <label><center>Wähle die Ministranten aus, mit denen du gerne zusammen eingeteilt wirst.</center></label>
            <hr></hr>
            <Select
                mode="multiple"
                style={{ width: "100%", marginTop: 6 }}
                placeholder="Ministranten auswählen"
                value={preferred}
                onChange={handleChange}
                maxTagCount={3}
                showSearch
                filterOption={(input, option) =>
                    (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                }

            >
                {allUsers
                    .filter(u => u.id !== userId)
                    .map(u => (
                        <Select.Option
                            key={u.id}
                            value={u.id}
                            label={`${u.firstname} ${u.lastname}`}
                        >
                            {u.firstname} {u.lastname}
                        </Select.Option>
                    ))}
            </Select>
        </div>
    );
}
