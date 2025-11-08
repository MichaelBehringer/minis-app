import React, { useEffect, useState } from "react";
import { Calendar, Spin, message } from "antd";
import { doGetRequestAuth, doPatchRequestAuth } from "../helper/RequestHelper";

export default function UserBanDates({ userId, token }) {
    const [loading, setLoading] = useState(true);
    const [banDates, setBanDates] = useState([]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const res = await doGetRequestAuth(`user/${userId}/ban`, token);
            setBanDates(res.data || []);
            setLoading(false);
        }
        load();
    }, [userId, token]);

    // prüfen: ist Datum gesperrt?
    const isBanned = (date) => {
        const d = date.format("YYYY-MM-DD");
        return banDates.includes(d);
    };

    // toggle sperrung
    const toggleDate = async (value) => {
        const dateString = value.format("YYYY-MM-DD");
        const isBan = banDates.includes(dateString);

        const payload = {
            date: dateString,
            add: !isBan
        };

        const updated = isBan
            ? banDates.filter(d => d !== dateString)
            : [...banDates, dateString];

        setBanDates(updated);

        await doPatchRequestAuth(`user/${userId}/ban`, payload, token);
        message.success("Änderung gespeichert");
    };


    // Datum markieren
    const dateCellRender = (value) => {
        if (isBanned(value)) {
            return (
                <div
                    style={{
                        backgroundColor: "#ffccc7",
                        borderRadius: 6,
                        padding: 2,
                        textAlign: "center"
                    }}
                >🛑</div>
            );
        }
        return null;
    };

    if (loading) return <Spin />;

    return (
        <div>
            <label><center>Wähle die Tage aus, an denen du nicht ministrieren kannst.</center></label>
            <hr></hr>
            <Calendar
                fullscreen={false}
                cellRender={dateCellRender}
                onSelect={(value, info) => {
                    if (info?.source === "date") {
                        toggleDate(value);
                    }
                }}
            />
        </div>
    );
}
