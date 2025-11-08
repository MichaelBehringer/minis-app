import React, { useEffect, useState } from "react";
import { Button, Spin, message } from "antd";
import { doGetRequestAuth, doPatchRequestAuth } from "../helper/RequestHelper";

import "./UserPreferredWeekdays.css"

const WEEKDAYS = [
    { key: "MON", label: "Montag" },
    { key: "TUE", label: "Dienstag" },
    { key: "WED", label: "Mittwoch" },
    { key: "THU", label: "Donnerstag" },
    { key: "FRI", label: "Freitag" },
    { key: "SAT", label: "Samstag" },
    { key: "SUN", label: "Sonntag" }
];

export default function UserPreferredWeekdays({ userId, token }) {
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState([]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const res = await doGetRequestAuth(`user/${userId}/weekday`, token);
            setSelected(res.data || []);
            setLoading(false);
        }
        load();
    }, [userId, token]);

    const toggle = async (wd) => {
        const isActive = selected.includes(wd);

        const payload = {
            weekday: wd,
            add: !isActive
        };

        // UI sofort aktualisieren
        const updated = isActive
            ? selected.filter((d) => d !== wd)
            : [...selected, wd];

        setSelected(updated);

        await doPatchRequestAuth(`user/${userId}/weekday`, payload, token);
        message.success("Änderung gespeichert");
    };


    if (loading) return <Spin />;

    return (
        <div>
            <label><center>Wähle die Wochentage aus, an denen du am liebsten eingeteilt werden möchtest.</center></label>
            <hr></hr>
            <div className="weekday-container">
                {WEEKDAYS.map((d) => (
                    <React.Fragment key={d.key}>
                        <Button
                            className={`weekday-button ${selected.includes(d.key) ? "active" : ""}`}
                            onClick={() => toggle(d.key)}
                            block
                        >
                            {d.label}
                        </Button>

                        {/* Trennstrich nach Freitag */}
                        {d.key === "FRI" && <div className="weekday-divider"></div>}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );

}
