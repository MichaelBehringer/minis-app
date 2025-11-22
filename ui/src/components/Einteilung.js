import { useEffect, useState } from "react";
import {
  DatePicker,
  Button,
  Card,
  Select,
  Row,
  Col,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
} from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  doGetRequestAuth,
  doPatchRequestAuth,
  doPutRequestAuth,
} from "../helper/RequestHelper";

const { RangePicker } = DatePicker;

export default function Einteilung({ token }) {
  const [dateRange, setDateRange] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);

  const [locationList, setLocationList] = useState([]);
  const [newEventModalOpen, setNewEventModalOpen] = useState(false);

  const [form] = Form.useForm();

  useEffect(() => {
    doGetRequestAuth("user", token).then((res) => setUsers(res.data));
    doGetRequestAuth("location", token).then((res) => setLocationList(res.data));
  }, [token]);

  const loadEvents = (range) => {
    if (!range || !range[0] || !range[1]) return;
    const from = dayjs(range[0]).format("YYYY-MM-DD");
    const to = dayjs(range[1]).format("YYYY-MM-DD");

    doGetRequestAuth(`events?from=${from}&to=${to}`, token).then((res) => {
      setEvents(res.data);
    });
  };

  const handleAutoAssign = (eventId) => {
    doGetRequestAuth(`autoAssign?eventId=${eventId}`, token).then(() => {
      loadEvents(dateRange);
    });
  };

  const submitNewEvent = () => {
    form.validateFields().then((values) => {
      const payload = {
        name: values.name,
        dateBegin: values.date.format("YYYY-MM-DD"),
        timeBegin: values.time.format("HH:mm:ss"),
        locationId: values.locationId,
        minimalUser: values.minimalUser,
      };

      doPutRequestAuth("event", payload, token).then(() => {
        setNewEventModalOpen(false);
        form.resetFields();
        loadEvents(dateRange);
        message.success("Messe angelegt");
      });
    }).catch(() => {
    });
  };

  return (
    <div>
      {/* Buttons umbrechen automatisch */}
      <Space style={{ marginBottom: 20 }} wrap>
        <RangePicker
          value={dateRange}
          onChange={(v) => {
            setDateRange(v);
            loadEvents(v);
          }}
        />

        <Button icon={<PlusOutlined />} type="primary" onClick={() => setNewEventModalOpen(true)}>
          Neue Messe
        </Button>

        <Button icon={<DownloadOutlined />}>PDF Export</Button>
      </Space>

      {/* NEUE MESSE MODAL */}
      <Modal
        open={newEventModalOpen}
        title="Neue Messe anlegen"
        onCancel={() => setNewEventModalOpen(false)}
        onOk={submitNewEvent}
        okText="Speichern"
        cancelText="Abbrechen"
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Bitte Name eingeben" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Datum"
            name="date"
            rules={[{ required: true, message: "Bitte Datum wählen" }]}
          >
            <DatePicker />
          </Form.Item>

          <Form.Item
            label="Uhrzeit"
            name="time"
            rules={[{ required: true, message: "Bitte Uhrzeit wählen" }]}
          >
            <DatePicker picker="time" format="HH:mm" />
          </Form.Item>

          <Form.Item
            label="Ort"
            name="locationId"
            rules={[{ required: true, message: "Bitte Ort auswählen" }]}
          >
            <Select
              options={locationList.map((loc) => ({
                value: loc.id,
                label: loc.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Minimale Ministranten"
            name="minimalUser"
            rules={[{ required: true, message: "Bitte Anzahl eingeben" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Row gutter={[16, 16]}>
        {events.map((ev) => (
          <Col xs={24} sm={12} md={8} lg={6} xl={4} key={ev.id}>
            <Card title={ev.name}>
              <p>
                Datum:{" "}
                <strong>
                  {ev.dateBegin} {ev.timeBegin.substring(0, 5)}
                </strong>
              </p>
              <p>
                Ort: <strong>{ev.location}</strong>
              </p>
              <p>
                Minimum Ministranten: <strong>{ev.minimalUser}</strong>
              </p>

              <Select
                mode="multiple"
                style={{ width: "100%", marginBottom: 12 }}
                placeholder="Benutzer zuordnen"
                value={ev.assignedUserIds || []}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                onChange={(newIds) => {
                  const oldIds = ev.assignedUserIds || [];

                  const added = newIds.find((id) => !oldIds.includes(id));
                  const removed = oldIds.find((id) => !newIds.includes(id));

                  if (added !== undefined) {
                    doPatchRequestAuth(
                      `events/${ev.id}/assign/add`,
                      { userId: added },
                      token
                    );
                    ev.assignedUserIds = [...oldIds, added];
                    setEvents([...events]);
                  }

                  if (removed !== undefined) {
                    doPatchRequestAuth(
                      `events/${ev.id}/assign/remove`,
                      { userId: removed },
                      token
                    );
                    ev.assignedUserIds = oldIds.filter((id) => id !== removed);
                    setEvents([...events]);
                  }
                }}
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.firstname} ${u.lastname}`,
                }))}
              />

              <Button type="primary" onClick={() => handleAutoAssign(ev.id)}>
                Automatisch zuweisen
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
