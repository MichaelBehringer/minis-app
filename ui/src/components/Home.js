import React, { useEffect, useState } from "react";
import { Calendar, Table, Segmented, Spin, Card } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { doGetRequestAuth } from "../helper/RequestHelper";

dayjs.locale("de");

export default function Home({ userId, token }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendar");

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const res = await doGetRequestAuth(`events/${userId}`, token);
        setEvents(res.data || []);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [userId, token, doGetRequestAuth]);

  // Kalender-Event-Renderer
  const dateCellRender = (value) => {
    const dateStr = value.format("YYYY-MM-DD");
    const todaysEvents = events.filter((e) => e.dateBegin === dateStr);

    return (
      <ul className="px-1 m-0 list-none">
        {todaysEvents.map((ev) => (
          <li key={ev.id} className="text-xs truncate">
            • {ev.name} ({ev.timeBegin})
          </li>
        ))}
      </ul>
    );
  };

  // Tabellenspalten
  const columns = [
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Datum", dataIndex: "dateBegin", key: "dateBegin" },
    { title: "Zeit", dataIndex: "timeBegin", key: "timeBegin" },
    { title: "Ort", dataIndex: "location", key: "location" }
  ];

  return (
    <div className="p-4 flex flex-col gap-4 max-w-4xl mx-auto">
      {/* Umschalter zwischen Kalender und Tabelle */}
      <Segmented
        block
        options={[{ label: "Kalender", value: "calendar" }, { label: "Tabelle", value: "table" }]}
        value={view}
        onChange={setView}
      />

      {loading ? (
        <div className="w-full flex justify-center py-10">
          <Spin size="large" />
        </div>
      ) : (
        <Card className="shadow-md rounded-2xl p-2">
          {view === "calendar" && (
            <Calendar fullscreen={true} dateCellRender={dateCellRender} />
          )}

          {view === "table" && (
            <Table
              dataSource={events.map((e) => ({ ...e, key: e.id }))}
              columns={columns}
              pagination={{ pageSize: 10 }}
              scroll={{ x: true }}
            />
          )}
        </Card>
      )}
    </div>
  );
}
