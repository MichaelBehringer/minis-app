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
  Tag,
  Tooltip,
  Spin,
  Checkbox,
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

  const [assignmentOptionsByEventId, setAssignmentOptionsByEventId] = useState({});
  const [assignmentOptionsLoadingByEventId, setAssignmentOptionsLoadingByEventId] = useState({});

  const [form] = Form.useForm();

  const AVAILABILITY_META = {
    ok: {
      groupLabel: "Alles ok",
      tagText: "OK",
      tagColor: "green",
    },
    weekday_inactive: {
      groupLabel: "Wochentag nicht aktiv",
      tagText: "Wochentag",
      tagColor: "orange",
    },
    banned: {
      groupLabel: "Gesperrt",
      tagText: "Sperrung",
      tagColor: "red",
    },
    inactive: {
      groupLabel: "Inaktive Benutzer",
      tagText: "Inaktiv",
      tagColor: "default",
    },
  };

  const AVAILABILITY_ORDER = [
    "ok",
    "weekday_inactive",
    "banned",
    "inactive",
  ];

  const loadAssignmentOptionsForEvent = async (eventId) => {
    if (assignmentOptionsByEventId[eventId] || assignmentOptionsLoadingByEventId[eventId]) {
      return;
    }

    setAssignmentOptionsLoadingByEventId((prev) => ({
      ...prev,
      [eventId]: true,
    }));

    try {
      const res = await doGetRequestAuth(
        `event/${eventId}/assignment-options`,
        token
      );

      setAssignmentOptionsByEventId((prev) => ({
        ...prev,
        [eventId]: res.data.options || [],
      }));
    } catch (e) {
      message.error("Verfügbarkeit konnte nicht geladen werden");
    } finally {
      setAssignmentOptionsLoadingByEventId((prev) => ({
        ...prev,
        [eventId]: false,
      }));
    }
  };

  const getUserName = (u) => `${u.firstname} ${u.lastname}`;

  const renderUserOptionLabel = (u) => {
    const meta = AVAILABILITY_META[u.status] || AVAILABILITY_META.ok;
    const name = getUserName(u);

    return (
      <Tooltip title={u.reason || meta.groupLabel}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{name}</span>
          <Tag color={meta.tagColor} style={{ marginInlineEnd: 0 }}>
            {meta.tagText}
          </Tag>
        </div>
      </Tooltip>
    );
  };

  const getAssignmentSelectOptions = (eventId) => {
    const loadedOptions = assignmentOptionsByEventId[eventId];

    // Vor dem Öffnen: normale User-Liste, damit bereits ausgewählte IDs Namen anzeigen können.
    if (!loadedOptions) {
      return users.map((u) => ({
        value: u.id,
        label: getUserName(u),
        searchLabel: getUserName(u),
      }));
    }

    return AVAILABILITY_ORDER.map((status) => {
      const meta = AVAILABILITY_META[status];

      return {
        label: <span>{meta.groupLabel}</span>,
        title: meta.groupLabel,
        options: loadedOptions
          .filter((u) => u.status === status)
          .map((u) => {
            const name = getUserName(u);

            return {
              value: u.id,
              label: renderUserOptionLabel(u),
              searchLabel: `${name} ${meta.groupLabel} ${u.reason || ""}`,

              // Falls du gesperrte Personen gar nicht auswählbar machen willst:
              // disabled: u.status === "banned",
            };
          }),
      };
    }).filter((group) => group.options.length > 0);
  };

  const filterUserOption = (input, option) => {
    const text =
      option?.searchLabel ||
      (typeof option?.label === "string" ? option.label : "");

    return text.toLowerCase().includes(input.toLowerCase());
  };

  const setAssignedUsersForEvent = (eventId, assignedUserIds) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
            ...event,
            assignedUserIds,
          }
          : event
      )
    );
  };

  const handleAssignmentChange = async (ev, newIds) => {
    const oldIds = ev.assignedUserIds || [];

    const addedIds = newIds.filter((id) => !oldIds.includes(id));
    const removedIds = oldIds.filter((id) => !newIds.includes(id));

    setAssignedUsersForEvent(ev.id, newIds);

    try {
      await Promise.all([
        ...addedIds.map((userId) =>
          doPatchRequestAuth(
            `events/${ev.id}/assign/add`,
            { userId },
            token
          )
        ),
        ...removedIds.map((userId) =>
          doPatchRequestAuth(
            `events/${ev.id}/assign/remove`,
            { userId },
            token
          )
        ),
      ]);
    } catch (e) {
      setAssignedUsersForEvent(ev.id, oldIds);
      message.error("Zuweisung konnte nicht gespeichert werden");
    }
  };

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

  const downloadPDF = () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.warning("Bitte zuerst einen Zeitraum auswählen");
      return;
    }

    const from = dayjs(dateRange[0]).format("YYYY-MM-DD");
    const to = dayjs(dateRange[1]).format("YYYY-MM-DD");

    const url = `/pdf/events?from=${from}&to=${to}`;

    window.open(url, "_blank");
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
        ignoreWeekday: values.ignoreWeekday,
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

        <Button onClick={downloadPDF} icon={<DownloadOutlined />}>PDF Export</Button>
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

          <Form.Item
            label="WochentagIgnorieren"
            name="ignoreWeekday"
            valuePropName="checked"
          >
            <Checkbox>Wochentag Ignorieren</Checkbox>
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
                loading={!!assignmentOptionsLoadingByEventId[ev.id]}
                notFoundContent={
                  assignmentOptionsLoadingByEventId[ev.id] ? <Spin size="small" /> : null
                }
                onOpenChange={(open) => {
                  if (open) {
                    loadAssignmentOptionsForEvent(ev.id);
                  }
                }}
                filterOption={filterUserOption}
                onChange={(newIds) => handleAssignmentChange(ev, newIds)}
                options={getAssignmentSelectOptions(ev.id)}
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
