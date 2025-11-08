import React, { useEffect, useState } from "react";
import { Calendar, Table, Segmented, Spin, Card, Modal, Button } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { doGetRequestAuth } from "../helper/RequestHelper";

dayjs.locale("de");

export default function Home({ userId, token }) {
  const [events, setEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendar");
  const [isModalOpen, setIsModalOpen] = useState(false);

  function getEventsForDate(value) {
    const dateStr = value.format("YYYY-MM-DD");
    const todaysEvents = events.filter((e) => e.dateBegin === dateStr);
    return todaysEvents
  }

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        await doGetRequestAuth(`user/${userId}`, token)
        const res = await doGetRequestAuth(`events/${userId}`, token);
        setEvents(res.data || []);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [userId, token]);

  const handleDateSelect = (date) => {
    const todaysEvents = getEventsForDate(date)
    if (todaysEvents.length !== 0) {
      setSelectedEvents(todaysEvents)
      setIsModalOpen(true)
    }
  };

  // Kalender-Event-Renderer
  const dateCellRender = (value) => {
    const todaysEvents = getEventsForDate(value)

    return (
      todaysEvents.length !== 0 ?
        <div style={{ width: '100%', height: '100%', backgroundColor: 'royalblue', borderRadius: '10px' }}>

        </div>
        :
        <div />
    );
  };

  // Tabellenspalten
  const columns = [
    { title: "Beschreibung", dataIndex: "name", key: "name" },
    { title: "Datum", dataIndex: "dateBegin", key: "dateBegin" },
    { title: "Zeit", dataIndex: "timeBegin", key: "timeBegin" },
    { title: "Ort", dataIndex: "location", key: "location" }
  ];

  return (
    <div className="p-4 flex flex-col gap-4 max-w-4xl mx-auto">
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
            <Calendar fullscreen={true} showWeek cellRender={dateCellRender} onSelect={handleDateSelect} />
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
      <Modal
        title={null}
        open={isModalOpen}
        footer={<Button type="primary" onClick={() => setIsModalOpen(false)}>Ok</Button>}
        closable={false}
        onCancel={() => setIsModalOpen(false)}
      >
        {selectedEvents &&
          selectedEvents.map((ev) => (
            <Card
              key={ev.id}
              size="small"
              style={{
                marginBottom: 12,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: 15 }}>
                {ev.name}
              </div>

              <div style={{ marginTop: 4 }}>
                📅 {dayjs(ev.dateBegin).format("DD.MM.YYYY")}
              </div>

              <div>
                ⏰ {dayjs(ev.timeBegin, "HH:mm:ss").format("HH:mm")} Uhr
              </div>

              <div>
                📍 {ev.location}
              </div>
            </Card>
          ))}

      </Modal>

    </div>
  );
}
