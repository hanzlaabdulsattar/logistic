--
-- PostgreSQL database dump
--

\restrict tmR45MCIVbLGRK8vHeR7tdxlOc4N9MiHvlBEbiKAyinW9A46ub1c5zj9rlMk9SD

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: driverstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driverstatus AS ENUM (
    'AVAILABLE',
    'ON_DELIVERY',
    'ON_LEAVE',
    'SUSPENDED'
);


--
-- Name: incidentstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.incidentstatus AS ENUM (
    'REPORTED',
    'RECOVERY_IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


--
-- Name: incidenttype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.incidenttype AS ENUM (
    'BREAKDOWN',
    'ACCIDENT',
    'FLAT_TIRE',
    'ENGINE_FAILURE',
    'OTHER'
);


--
-- Name: maintenancestatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenancestatus AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED'
);


--
-- Name: maintenancetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenancetype AS ENUM (
    'SCHEDULED',
    'EMERGENCY',
    'INSPECTION'
);


--
-- Name: notificationtype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notificationtype AS ENUM (
    'ORDER_UPDATE',
    'INCIDENT_ALERT',
    'RECOVERY_REQUEST',
    'RECOVERY_RESPONSE',
    'SYSTEM'
);


--
-- Name: orderstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orderstatus AS ENUM (
    'PENDING',
    'ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED',
    'REASSIGNED'
);


--
-- Name: parcelstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.parcelstatus AS ENUM (
    'PENDING',
    'LOADED',
    'IN_TRANSIT',
    'DELIVERED',
    'TRANSFERRED'
);


--
-- Name: parceltransferstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.parceltransferstatus AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED'
);


--
-- Name: recoveryrequeststatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recoveryrequeststatus AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED',
    'COMPLETED'
);


--
-- Name: recoveryresponsestatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recoveryresponsestatus AS ENUM (
    'ACCEPTED',
    'REJECTED'
);


--
-- Name: truckstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.truckstatus AS ENUM (
    'AVAILABLE',
    'IN_TRANSIT',
    'BREAKDOWN',
    'MAINTENANCE',
    'OFF_DUTY'
);


--
-- Name: userrole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userrole AS ENUM (
    'ADMIN',
    'DRIVER',
    'CUSTOMER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    user_id integer NOT NULL,
    address character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id integer NOT NULL,
    user_id integer NOT NULL,
    license_number character varying(50) NOT NULL,
    truck_id integer,
    status public.driverstatus NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drivers_id_seq OWNED BY public.drivers.id;


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id integer NOT NULL,
    truck_id integer NOT NULL,
    driver_id integer NOT NULL,
    type public.incidenttype NOT NULL,
    description character varying(1000),
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    status public.incidentstatus NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidents_id_seq OWNED BY public.incidents.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type public.notificationtype NOT NULL,
    title character varying(255) NOT NULL,
    message character varying(1000) NOT NULL,
    is_read boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_reassignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_reassignments (
    id integer NOT NULL,
    order_id integer NOT NULL,
    from_driver_id integer NOT NULL,
    to_driver_id integer NOT NULL,
    reason character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_reassignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_reassignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_reassignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_reassignments_id_seq OWNED BY public.order_reassignments.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    driver_id integer,
    status public.orderstatus NOT NULL,
    pickup_lat double precision NOT NULL,
    pickup_lng double precision NOT NULL,
    delivery_lat double precision NOT NULL,
    delivery_lng double precision NOT NULL,
    pickup_address character varying(500),
    delivery_address character varying(500),
    deadline timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    weight_kg double precision,
    distance_km double precision,
    rate_per_km double precision,
    rate_per_kg double precision,
    base_fee double precision,
    handling_fee double precision,
    amount double precision,
    currency character varying(10),
    pricing_formula character varying(500)
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: parcel_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parcel_transfers (
    id integer NOT NULL,
    recovery_request_id integer NOT NULL,
    parcel_id integer NOT NULL,
    from_truck_id integer NOT NULL,
    to_truck_id integer NOT NULL,
    status public.parceltransferstatus NOT NULL,
    transferred_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parcel_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parcel_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parcel_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parcel_transfers_id_seq OWNED BY public.parcel_transfers.id;


--
-- Name: parcels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parcels (
    id integer NOT NULL,
    order_id integer NOT NULL,
    truck_id integer,
    weight_kg double precision NOT NULL,
    description character varying(500),
    status public.parcelstatus NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parcels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parcels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parcels_id_seq OWNED BY public.parcels.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    order_id integer NOT NULL,
    customer_user_id integer,
    amount double precision NOT NULL,
    currency character varying(10) DEFAULT 'PKR'::character varying,
    method character varying(20) NOT NULL,
    provider character varying(50),
    provider_payment_id character varying(100),
    checkout_url character varying(1000),
    status character varying(20) NOT NULL,
    message character varying(500),
    description character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: recovery_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recovery_requests (
    id integer NOT NULL,
    incident_id integer NOT NULL,
    source_truck_id integer NOT NULL,
    target_truck_id integer NOT NULL,
    target_driver_id integer NOT NULL,
    status public.recoveryrequeststatus NOT NULL,
    distance_km double precision,
    free_space_kg integer,
    ai_reasoning character varying(2000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recovery_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recovery_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recovery_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recovery_requests_id_seq OWNED BY public.recovery_requests.id;


--
-- Name: recovery_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recovery_responses (
    id integer NOT NULL,
    recovery_request_id integer NOT NULL,
    driver_id integer NOT NULL,
    status public.recoveryresponsestatus NOT NULL,
    responded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recovery_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recovery_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recovery_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recovery_responses_id_seq OWNED BY public.recovery_responses.id;


--
-- Name: route_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route_history (
    id integer NOT NULL,
    driver_id integer NOT NULL,
    truck_id integer NOT NULL,
    order_id integer,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: route_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.route_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: route_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.route_history_id_seq OWNED BY public.route_history.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description character varying(500),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: tracking_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracking_logs (
    id integer NOT NULL,
    truck_id integer NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tracking_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tracking_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tracking_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tracking_logs_id_seq OWNED BY public.tracking_logs.id;


--
-- Name: trucks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trucks (
    id integer NOT NULL,
    plate_number character varying(20) NOT NULL,
    model character varying(100) NOT NULL,
    capacity_kg integer NOT NULL,
    current_load_kg integer NOT NULL,
    status public.truckstatus NOT NULL,
    current_lat double precision,
    current_lng double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trucks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trucks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trucks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trucks_id_seq OWNED BY public.trucks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    phone character varying(20),
    role public.userrole NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicle_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_maintenance (
    id integer NOT NULL,
    truck_id integer NOT NULL,
    type public.maintenancetype NOT NULL,
    description character varying(1000),
    status public.maintenancestatus NOT NULL,
    scheduled_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vehicle_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicle_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicle_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicle_maintenance_id_seq OWNED BY public.vehicle_maintenance.id;


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: drivers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers ALTER COLUMN id SET DEFAULT nextval('public.drivers_id_seq'::regclass);


--
-- Name: incidents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents ALTER COLUMN id SET DEFAULT nextval('public.incidents_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_reassignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reassignments ALTER COLUMN id SET DEFAULT nextval('public.order_reassignments_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: parcel_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_transfers ALTER COLUMN id SET DEFAULT nextval('public.parcel_transfers_id_seq'::regclass);


--
-- Name: parcels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcels ALTER COLUMN id SET DEFAULT nextval('public.parcels_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: recovery_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_requests ALTER COLUMN id SET DEFAULT nextval('public.recovery_requests_id_seq'::regclass);


--
-- Name: recovery_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_responses ALTER COLUMN id SET DEFAULT nextval('public.recovery_responses_id_seq'::regclass);


--
-- Name: route_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_history ALTER COLUMN id SET DEFAULT nextval('public.route_history_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: tracking_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_logs ALTER COLUMN id SET DEFAULT nextval('public.tracking_logs_id_seq'::regclass);


--
-- Name: trucks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trucks ALTER COLUMN id SET DEFAULT nextval('public.trucks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicle_maintenance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_maintenance ALTER COLUMN id SET DEFAULT nextval('public.vehicle_maintenance_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
05e4387f16b8
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, user_id, address, created_at, updated_at) FROM stdin;
1	18	\N	2026-10-05 14:22:31.518117+00	2026-10-05 14:22:31.518117+00
2	3	Lahore	2026-10-06 14:37:12.78335+00	2026-10-06 14:37:12.78335+00
\.


--
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.drivers (id, user_id, license_number, truck_id, status, created_at, updated_at) FROM stdin;
2	16	005	2	AVAILABLE	2026-10-05 14:41:13.253506+00	2026-10-05 14:41:13.253506+00
3	17	006	3	AVAILABLE	2026-10-05 15:00:05.975271+00	2026-10-05 15:00:05.975271+00
1	1	DL-0001-ALIDRIVE	1	AVAILABLE	2026-10-05 14:37:48.132762+00	2026-10-06 10:14:25.764276+00
4	4	DL-TEST-1	4	AVAILABLE	2026-10-06 14:37:12.78335+00	2026-10-06 14:37:12.78335+00
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incidents (id, truck_id, driver_id, type, description, lat, lng, status, created_at, updated_at) FROM stdin;
1	1	1	ACCIDENT	\N	31.5228	31.5249	RESOLVED	2026-10-05 14:50:07.654284+00	2026-10-06 10:18:13.542983+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, message, is_read, created_at) FROM stdin;
1	18	ORDER_UPDATE	Order #1 created	Your order has been created successfully. Route: devsinc → johar town. Status: pending. You can see who is assigned under My Orders once operations assign a driver.	f	2026-10-05 14:45:21.913972+00
2	18	ORDER_UPDATE	Order #1 driver assigned	Your order #1 has been assigned to ali · License DL-0001-ALIDRIVE · Truck 004.	f	2026-10-05 14:45:21.913972+00
3	18	ORDER_UPDATE	Order #1 accepted	Driver ali · License DL-0001-ALIDRIVE · Truck 004 accepted your order #1. Status is now assigned.	f	2026-10-05 14:46:38.052696+00
4	18	ORDER_UPDATE	Order #1 status update	Order #1 is now in transit.	f	2026-10-05 14:46:40.858119+00
5	15	INCIDENT_ALERT	Fleet alert: Incident #1 · Truck #1	A driver reported accident on truck #1 (004) at (31.52280, 31.52490). Nearby drivers: stay alert; admin may request recovery assist.	f	2026-10-05 14:50:07.654284+00
7	17	INCIDENT_ALERT	Fleet alert: Incident #1 · Truck #1	A driver reported accident on truck #1 (004) at (31.52280, 31.52490). Nearby drivers: stay alert; admin may request recovery assist.	f	2026-10-05 14:50:07.654284+00
6	16	INCIDENT_ALERT	Fleet alert: Incident #1 · Truck #1	A driver reported accident on truck #1 (004) at (31.52280, 31.52490). Nearby drivers: stay alert; admin may request recovery assist.	t	2026-10-05 14:50:07.654284+00
8	18	ORDER_UPDATE	Order #1 reassigned	Your order #1 was reassigned to alidriver · License 005 · Truck lhr 005. Reason: Admin reassignment	f	2026-10-06 11:30:35.770378+00
9	18	ORDER_UPDATE	Order #2 created	Your order has been created successfully. Route: pickup location → delivery location. Status: pending. You can see who is assigned under My Orders once operations assign a driver.	f	2026-10-06 14:21:28.00283+00
10	18	ORDER_UPDATE	Order #2 driver assigned	Your order #2 has been assigned to ali · License DL-0001-ALIDRIVE · Truck 004.	f	2026-10-06 14:21:28.00283+00
11	18	ORDER_UPDATE	Order #8 created	Your order has been created successfully. Route: LHR → JT. Status: pending. You can see who is assigned under My Orders once operations assign a driver.	f	2026-10-06 14:37:39.46691+00
12	18	ORDER_UPDATE	Order #8 driver assigned	Your order #8 has been assigned to alidriver2 · License 006 · Truck lhr 006.	f	2026-10-06 14:37:39.46691+00
13	3	ORDER_UPDATE	Order #10 created	Your order has been created successfully. Route: Lahore Hub → Johar Town. Status: pending. You can see who is assigned under My Orders once operations assign a driver.	f	2026-10-06 14:41:17.20638+00
14	3	ORDER_UPDATE	Order #10 driver assigned	Your order #10 has been assigned to Driver One · License DL-TEST-1 · Truck DRV-TEST-1.	f	2026-10-06 14:41:17.20638+00
15	3	ORDER_UPDATE	Order #11 created	Your order has been created successfully. Route: A → B. Status: pending. You can see who is assigned under My Orders once operations assign a driver.	f	2026-10-06 14:46:20.124529+00
16	3	ORDER_UPDATE	Order #11 driver assigned	Your order #11 has been assigned to ali · License DL-0001-ALIDRIVE · Truck 004.	f	2026-10-06 14:46:20.124529+00
17	18	ORDER_UPDATE	Order #2 reassigned	Your order #2 was reassigned to alidriver · License 005 · Truck lhr 005. Reason: Admin reassignment	f	2026-10-06 14:59:52.972366+00
18	3	ORDER_UPDATE	Order #11 reassigned	Your order #11 was reassigned to alidriver · License 005 · Truck lhr 005. Reason: Admin reassignment	f	2026-10-06 15:01:44.680009+00
19	3	ORDER_UPDATE	Order #13 created	Your order has been created successfully. Route: A → B. Status: pending. You can see who is assigned under My Orders once operations assign a driver.	f	2026-10-07 09:12:05.811407+00
20	3	ORDER_UPDATE	Order #13 driver assigned	Your order #13 has been assigned to ali · License DL-0001-ALIDRIVE · Truck 004.	f	2026-10-07 09:12:05.811407+00
21	3	ORDER_UPDATE	Order #14 created	Your order has been created successfully. Route: LHR → JT. Status: pending. You can see who is assigned under My Orders once operations assign a driver.	f	2026-10-07 09:12:45.547718+00
22	3	ORDER_UPDATE	Order #14 driver assigned	Your order #14 has been assigned to ali · License DL-0001-ALIDRIVE · Truck 004.	f	2026-10-07 09:12:45.547718+00
\.


--
-- Data for Name: order_reassignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_reassignments (id, order_id, from_driver_id, to_driver_id, reason, created_at) FROM stdin;
1	1	1	2	Admin reassignment	2026-10-06 11:30:35.770378+00
2	2	1	2	Admin reassignment	2026-10-06 14:59:52.972366+00
3	11	1	2	Admin reassignment	2026-10-06 15:01:44.680009+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, customer_id, driver_id, status, pickup_lat, pickup_lng, delivery_lat, delivery_lng, pickup_address, delivery_address, deadline, created_at, updated_at, priority, weight_kg, distance_km, rate_per_km, rate_per_kg, base_fee, handling_fee, amount, currency, pricing_formula) FROM stdin;
1	1	2	IN_TRANSIT	31.4928024	74.4175775	31.46979	74.27286	devsinc	johar town	2026-10-19 16:47:00+00	2026-10-05 14:45:21.913972+00	2026-10-06 11:30:35.770378+00	normal	\N	\N	\N	\N	\N	\N	\N	\N	\N
8	1	3	PENDING	31.52	74.35	31.56	74.33	LHR	JT	\N	2026-10-06 14:37:39.46691+00	2026-10-06 14:37:39.46691+00	normal	5	4.8	20	0	0	0	96	PKR	4.8 km × PKR 20/km = PKR 96.00
10	2	4	PENDING	31.5204	74.3587	31.56	74.33	Lahore Hub	Johar Town	\N	2026-10-06 14:41:17.20638+00	2026-10-06 14:41:17.20638+00	normal	5	5.2	20	0	0	0	104	PKR	5.2 km × PKR 20/km = PKR 104.00
2	1	2	PENDING	31.4928544	74.417526	31.46979	74.27286	\N	\N	2026-10-08 14:17:00+00	2026-10-06 14:21:28.00283+00	2026-10-06 14:59:52.972366+00	normal	\N	\N	\N	\N	\N	\N	\N	\N	\N
11	2	2	PENDING	31.52	74.35	31.54	74.34	A	B	\N	2026-10-06 14:46:20.124529+00	2026-10-06 15:01:44.680009+00	normal	50	2.4	20	0	0	0	48	PKR	2.4 km × PKR 20/km = PKR 48.00
13	2	1	PENDING	31.52	74.35	31.54	74.34	A	B	\N	2026-10-07 09:12:05.811407+00	2026-10-07 09:12:05.811407+00	normal	5	2.4	20	0	0	0	48	PKR	2.4 km × PKR 20/km = PKR 48.00
14	2	1	PENDING	31.52	74.35	31.545	74.34	LHR	JT	\N	2026-10-07 09:12:45.547718+00	2026-10-07 09:12:45.547718+00	normal	8	2.9	20	0	0	0	58	PKR	2.9 km × PKR 20/km = PKR 58.00
\.


--
-- Data for Name: parcel_transfers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parcel_transfers (id, recovery_request_id, parcel_id, from_truck_id, to_truck_id, status, transferred_at, created_at) FROM stdin;
\.


--
-- Data for Name: parcels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parcels (id, order_id, truck_id, weight_kg, description, status, created_at, updated_at) FROM stdin;
1	1	1	1	Parcel for order #1	PENDING	2026-10-05 14:45:21.913972+00	2026-10-05 14:45:21.913972+00
2	2	1	1	Parcel for order #2	PENDING	2026-10-06 14:21:28.00283+00	2026-10-06 14:21:28.00283+00
3	8	3	5	Parcel for order #8	PENDING	2026-10-06 14:37:39.46691+00	2026-10-06 14:37:39.46691+00
4	10	4	5	Parcel for order #10	PENDING	2026-10-06 14:41:17.20638+00	2026-10-06 14:41:17.20638+00
5	11	1	50	Parcel for order #11	PENDING	2026-10-06 14:46:20.124529+00	2026-10-06 14:46:20.124529+00
6	13	1	5	Parcel for order #13	PENDING	2026-10-07 09:12:05.811407+00	2026-10-07 09:12:05.811407+00
7	14	1	8	Parcel for order #14	PENDING	2026-10-07 09:12:45.547718+00	2026-10-07 09:12:45.547718+00
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, order_id, customer_user_id, amount, currency, method, provider, provider_payment_id, checkout_url, status, message, description, created_at, updated_at) FROM stdin;
1	13	3	48	PKR	safepay	safepay	\N	http://127.0.0.1:5173/customer/payments/checkout?payment_id=None&order_id=13&amount=48.0&currency=PKR&env=sandbox&merchant=DEMO_MERCHANT&public_key=sp_public_demo_key_replace_me&demo=1&return_url=http%3A//127.0.0.1%3A5173/customer/payments/result%3Forder_id%3D13&cancel_url=	pending	SafePay session created (sandbox). Public key configured: sp_public_de…	Delivery order #13 (A → B)	2026-10-07 09:12:06.09699+00	2026-10-07 09:12:06.09699+00
2	13	3	48	PKR	cod	cash_on_delivery	\N	\N	pending	collect on delivery	Cash on Delivery for order #13	2026-10-07 09:12:06.239161+00	2026-10-07 09:12:06.239161+00
3	14	3	58	PKR	safepay	safepay	SP-TEST-1	http://127.0.0.1:5173/customer/payments/checkout?payment_id=3&order_id=14&amount=58.0&currency=PKR&env=sandbox&merchant=DEMO_MERCHANT&public_key=sp_public_demo_key_replace_me&demo=1&return_url=&cancel_url=	paid	Sandbox verified	Delivery order #14 (LHR → JT)	2026-10-07 09:12:45.828693+00	2026-10-07 09:12:46.277966+00
\.


--
-- Data for Name: recovery_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recovery_requests (id, incident_id, source_truck_id, target_truck_id, target_driver_id, status, distance_km, free_space_kg, ai_reasoning, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recovery_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recovery_responses (id, recovery_request_id, driver_id, status, responded_at) FROM stdin;
\.


--
-- Data for Name: route_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.route_history (id, driver_id, truck_id, order_id, started_at, completed_at) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, key, value, description, updated_at) FROM stdin;
\.


--
-- Data for Name: tracking_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tracking_logs (id, truck_id, lat, lng, "timestamp") FROM stdin;
1	1	31.4928189	74.417567	2026-10-05 14:46:41.745471+00
2	1	31.4928189	74.417567	2026-10-05 14:46:42.760778+00
3	1	31.4928189	74.417567	2026-10-05 14:46:45.766871+00
4	1	31.4928189	74.417567	2026-10-05 14:46:51.327755+00
5	1	31.4928189	74.417567	2026-10-05 14:46:56.308205+00
6	1	31.4928189	74.417567	2026-10-05 14:47:01.31803+00
7	1	31.4928189	74.417567	2026-10-05 14:47:06.400394+00
8	1	31.4928189	74.417567	2026-10-05 14:47:11.318051+00
9	1	31.4928189	74.417567	2026-10-05 14:47:16.316606+00
10	1	31.4928189	74.417567	2026-10-05 14:47:21.317504+00
11	1	31.4928189	74.417567	2026-10-05 14:47:26.317117+00
12	1	31.4928189	74.417567	2026-10-05 14:47:31.308774+00
13	1	31.4928189	74.417567	2026-10-05 14:47:36.378437+00
14	1	31.4928189	74.417567	2026-10-05 14:47:41.318165+00
15	1	31.4928189	74.417567	2026-10-05 14:47:46.326119+00
16	1	31.4928189	74.417567	2026-10-05 14:48:15.573553+00
17	1	31.492799	74.4175886	2026-10-05 14:48:15.988037+00
18	1	31.492799	74.4175886	2026-10-05 14:48:17.980072+00
19	1	31.492819	74.4175741	2026-10-05 14:48:18.991743+00
20	1	31.492819	74.4175741	2026-10-05 14:48:20.766759+00
21	1	31.492819	74.4175741	2026-10-05 14:48:25.757304+00
22	1	31.492819	74.4175741	2026-10-05 14:48:30.757949+00
23	1	31.492819	74.4175741	2026-10-05 14:48:35.755572+00
24	1	31.492819	74.4175741	2026-10-05 14:48:40.776404+00
25	1	31.492819	74.4175741	2026-10-05 14:48:45.765643+00
26	1	31.492819	74.4175741	2026-10-05 14:48:50.758773+00
27	1	31.492819	74.4175741	2026-10-05 14:48:56.31545+00
28	1	31.492819	74.4175741	2026-10-05 14:49:01.31302+00
29	1	31.492819	74.4175741	2026-10-05 14:49:06.411316+00
30	1	31.492819	74.4175741	2026-10-05 14:49:11.314952+00
31	1	31.492819	74.4175741	2026-10-05 14:49:16.323537+00
32	1	31.492819	74.4175741	2026-10-05 14:49:21.320239+00
33	1	31.492819	74.4175741	2026-10-05 14:49:26.307694+00
34	1	31.492819	74.4175741	2026-10-05 14:49:31.315438+00
35	1	31.492819	74.4175741	2026-10-05 14:49:36.354278+00
36	1	31.492819	74.4175741	2026-10-05 14:49:41.307586+00
37	1	31.492819	74.4175741	2026-10-05 14:49:46.335386+00
38	1	31.492819	74.4175741	2026-10-05 14:49:47.755233+00
39	1	31.492819	74.4175741	2026-10-05 14:49:49.691254+00
40	1	31.492819	74.4175741	2026-10-05 14:49:50.763732+00
41	1	31.492819	74.4175741	2026-10-05 14:49:56.316204+00
42	1	31.492819	74.4175741	2026-10-05 14:50:01.308651+00
43	1	31.492819	74.4175741	2026-10-05 14:50:03.871604+00
44	1	31.492819	74.4175741	2026-10-05 14:50:05.7554+00
45	1	31.492819	74.4175741	2026-10-05 14:50:05.874699+00
46	2	31.4928425	74.4175526	2026-10-06 11:31:36.847845+00
47	2	31.4928425	74.4175526	2026-10-06 11:31:37.078674+00
48	2	31.4928425	74.4175526	2026-10-06 11:31:37.401523+00
49	2	31.4928425	74.4175526	2026-10-06 11:31:42.137612+00
50	2	31.4928255	74.4175596	2026-10-06 11:31:45.633878+00
51	2	31.4928255	74.4175596	2026-10-06 11:31:47.056784+00
52	2	31.4928255	74.4175596	2026-10-06 11:31:52.060181+00
53	2	31.4928255	74.4175596	2026-10-06 11:31:57.058503+00
54	2	31.4928255	74.4175596	2026-10-06 11:32:02.058487+00
55	2	31.4928255	74.4175596	2026-10-06 11:32:07.059706+00
56	2	31.4928255	74.4175596	2026-10-06 11:32:12.391936+00
57	2	31.4928255	74.4175596	2026-10-06 11:32:17.053731+00
58	2	31.4928255	74.4175596	2026-10-06 11:32:22.06852+00
59	2	31.4928255	74.4175596	2026-10-06 11:32:27.059936+00
60	2	31.4928255	74.4175596	2026-10-06 11:32:32.060474+00
61	2	31.4928255	74.4175596	2026-10-06 11:32:37.06049+00
62	2	31.4928255	74.4175596	2026-10-06 11:32:42.356352+00
63	2	31.4928448	74.4175737	2026-10-06 14:27:22.864171+00
64	2	31.4928448	74.4175737	2026-10-06 14:27:24.396288+00
65	2	31.4928448	74.4175737	2026-10-06 14:27:27.379492+00
66	2	31.4928448	74.4175737	2026-10-06 14:27:32.403535+00
67	2	31.4928595	74.417563	2026-10-06 14:27:32.673788+00
68	2	31.4928595	74.417563	2026-10-06 14:27:37.394749+00
69	2	31.4928595	74.417563	2026-10-06 14:27:42.388681+00
70	2	31.4928595	74.417563	2026-10-06 14:27:47.388042+00
71	2	31.4928595	74.417563	2026-10-06 14:27:52.38749+00
72	2	31.4928595	74.417563	2026-10-06 14:27:57.388624+00
73	2	31.4928595	74.417563	2026-10-06 14:28:02.383462+00
74	2	31.4928526	74.4175533	2026-10-06 14:58:41.758261+00
75	2	31.4928526	74.4175533	2026-10-06 14:58:42.82467+00
76	2	31.4928526	74.4175533	2026-10-06 14:58:45.543235+00
77	2	31.4928526	74.4175533	2026-10-06 14:58:50.528775+00
78	2	31.4928526	74.4175533	2026-10-06 14:58:55.518974+00
\.


--
-- Data for Name: trucks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trucks (id, plate_number, model, capacity_kg, current_load_kg, status, current_lat, current_lng, created_at, updated_at) FROM stdin;
3	lhr 006	hino 88	8000	0	AVAILABLE	\N	\N	2026-10-05 15:00:05.938788+00	2026-10-05 15:00:05.938788+00
1	004	hin400	8000	0	IN_TRANSIT	31.492819	74.4175741	2026-10-05 14:39:35.852537+00	2026-10-06 10:14:35.451094+00
4	DRV-TEST-1	Hino 300	9000	0	AVAILABLE	31.5	74.3	2026-10-06 14:37:12.78335+00	2026-10-06 14:37:12.78335+00
2	lhr 005	hino005	8000	0	IN_TRANSIT	31.4928526	74.4175533	2026-10-05 14:41:13.177204+00	2026-10-06 14:58:41.758261+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at) FROM stdin;
15	hanzlaabdulsattar@gmail.com	$2b$12$rcOJ2q8DoAwpS.v3.DyOT.D7el/kZTI1Ios/hMV2uN75Vuz8wteRi	Hanzla Abdul sattar	\N	ADMIN	t	2026-10-05 14:22:28.472776+00	2026-10-05 14:22:28.472776+00
16	alidriver@gmail.com	$2b$12$yFGk7wvgn8xUPc6Uw5mryOOHtuwh1I284QnmmXpjLkdZpW8notWCa	alidriver	\N	DRIVER	t	2026-10-05 14:22:28.472776+00	2026-10-05 14:22:28.472776+00
17	alidriver2@gmail.com	$2b$12$fKHBFKWY.IZIQH3RmZNiTeBENIBigQlrLwOMIhvBTQrkYgV8TzSWS	alidriver2	\N	DRIVER	t	2026-10-05 14:22:28.472776+00	2026-10-05 14:22:28.472776+00
18	alicustomer@gmail.com	$2b$12$Isiheu3WoGV.oQwuXdjiueRDNy7TMxdRHrbcRPpRrtB7xqjKUllMa	alicustomer	\N	CUSTOMER	t	2026-10-05 14:22:28.472776+00	2026-10-05 14:22:28.472776+00
1	alidriver1@gmail.com	$2b$12$sdN82HfSH9kZtWqI2se0huj/EtZNc7u/2hYOjAWGqZ0j9xrJhTDna	ali	\N	DRIVER	t	2026-10-05 14:37:48.132762+00	2026-10-05 14:37:48.132762+00
2	admin@test.com	$2b$12$Dq3ZQ4c5zaMAqCpAF8RxTOWiCDg27JwpFEfsM73AZp9q9szOT23..	Admin User	\N	ADMIN	t	2026-10-06 14:37:12.78335+00	2026-10-06 14:37:12.78335+00
3	customer@test.com	$2b$12$LXMvODjlnlJuYoxRZj9XHO0UTnNkN.36HM/s.nQam34bba/qtbyTa	Customer One	\N	CUSTOMER	t	2026-10-06 14:37:12.78335+00	2026-10-06 14:37:12.78335+00
4	driver@test.com	$2b$12$eMI0NcwNwi5PMZf9UT1sHug8/P.cQxolAlFbWVKbTTGNZ2aIMnSAO	Driver One	\N	DRIVER	t	2026-10-06 14:37:12.78335+00	2026-10-06 14:37:12.78335+00
\.


--
-- Data for Name: vehicle_maintenance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicle_maintenance (id, truck_id, type, description, status, scheduled_at, completed_at, created_at) FROM stdin;
\.


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 2, true);


--
-- Name: drivers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.drivers_id_seq', 4, true);


--
-- Name: incidents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.incidents_id_seq', 1, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 22, true);


--
-- Name: order_reassignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_reassignments_id_seq', 3, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 14, true);


--
-- Name: parcel_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.parcel_transfers_id_seq', 1, false);


--
-- Name: parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.parcels_id_seq', 7, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 3, true);


--
-- Name: recovery_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recovery_requests_id_seq', 1, false);


--
-- Name: recovery_responses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recovery_responses_id_seq', 1, false);


--
-- Name: route_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.route_history_id_seq', 1, false);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, false);


--
-- Name: tracking_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tracking_logs_id_seq', 78, true);


--
-- Name: trucks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.trucks_id_seq', 4, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: vehicle_maintenance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehicle_maintenance_id_seq', 1, false);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_key UNIQUE (user_id);


--
-- Name: drivers drivers_license_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_license_number_key UNIQUE (license_number);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_reassignments order_reassignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reassignments
    ADD CONSTRAINT order_reassignments_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: parcel_transfers parcel_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_transfers
    ADD CONSTRAINT parcel_transfers_pkey PRIMARY KEY (id);


--
-- Name: parcels parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcels
    ADD CONSTRAINT parcels_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: recovery_requests recovery_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_requests
    ADD CONSTRAINT recovery_requests_pkey PRIMARY KEY (id);


--
-- Name: recovery_responses recovery_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_responses
    ADD CONSTRAINT recovery_responses_pkey PRIMARY KEY (id);


--
-- Name: route_history route_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_history
    ADD CONSTRAINT route_history_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tracking_logs tracking_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_logs
    ADD CONSTRAINT tracking_logs_pkey PRIMARY KEY (id);


--
-- Name: trucks trucks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trucks
    ADD CONSTRAINT trucks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_maintenance vehicle_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_maintenance
    ADD CONSTRAINT vehicle_maintenance_pkey PRIMARY KEY (id);


--
-- Name: ix_system_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_system_settings_key ON public.system_settings USING btree (key);


--
-- Name: ix_trucks_plate_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_trucks_plate_number ON public.trucks USING btree (plate_number);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: drivers drivers_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES public.trucks(id);


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: incidents incidents_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: incidents incidents_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES public.trucks(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: order_reassignments order_reassignments_from_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reassignments
    ADD CONSTRAINT order_reassignments_from_driver_id_fkey FOREIGN KEY (from_driver_id) REFERENCES public.drivers(id);


--
-- Name: order_reassignments order_reassignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reassignments
    ADD CONSTRAINT order_reassignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_reassignments order_reassignments_to_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reassignments
    ADD CONSTRAINT order_reassignments_to_driver_id_fkey FOREIGN KEY (to_driver_id) REFERENCES public.drivers(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: parcel_transfers parcel_transfers_from_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_transfers
    ADD CONSTRAINT parcel_transfers_from_truck_id_fkey FOREIGN KEY (from_truck_id) REFERENCES public.trucks(id);


--
-- Name: parcel_transfers parcel_transfers_parcel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_transfers
    ADD CONSTRAINT parcel_transfers_parcel_id_fkey FOREIGN KEY (parcel_id) REFERENCES public.parcels(id);


--
-- Name: parcel_transfers parcel_transfers_recovery_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_transfers
    ADD CONSTRAINT parcel_transfers_recovery_request_id_fkey FOREIGN KEY (recovery_request_id) REFERENCES public.recovery_requests(id);


--
-- Name: parcel_transfers parcel_transfers_to_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_transfers
    ADD CONSTRAINT parcel_transfers_to_truck_id_fkey FOREIGN KEY (to_truck_id) REFERENCES public.trucks(id);


--
-- Name: parcels parcels_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcels
    ADD CONSTRAINT parcels_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: parcels parcels_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcels
    ADD CONSTRAINT parcels_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES public.trucks(id);


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: recovery_requests recovery_requests_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_requests
    ADD CONSTRAINT recovery_requests_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id);


--
-- Name: recovery_requests recovery_requests_source_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_requests
    ADD CONSTRAINT recovery_requests_source_truck_id_fkey FOREIGN KEY (source_truck_id) REFERENCES public.trucks(id);


--
-- Name: recovery_requests recovery_requests_target_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_requests
    ADD CONSTRAINT recovery_requests_target_driver_id_fkey FOREIGN KEY (target_driver_id) REFERENCES public.drivers(id);


--
-- Name: recovery_requests recovery_requests_target_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_requests
    ADD CONSTRAINT recovery_requests_target_truck_id_fkey FOREIGN KEY (target_truck_id) REFERENCES public.trucks(id);


--
-- Name: recovery_responses recovery_responses_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_responses
    ADD CONSTRAINT recovery_responses_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: recovery_responses recovery_responses_recovery_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_responses
    ADD CONSTRAINT recovery_responses_recovery_request_id_fkey FOREIGN KEY (recovery_request_id) REFERENCES public.recovery_requests(id);


--
-- Name: route_history route_history_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_history
    ADD CONSTRAINT route_history_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: route_history route_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_history
    ADD CONSTRAINT route_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: route_history route_history_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_history
    ADD CONSTRAINT route_history_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES public.trucks(id);


--
-- Name: tracking_logs tracking_logs_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_logs
    ADD CONSTRAINT tracking_logs_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES public.trucks(id);


--
-- Name: vehicle_maintenance vehicle_maintenance_truck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_maintenance
    ADD CONSTRAINT vehicle_maintenance_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES public.trucks(id);


--
-- PostgreSQL database dump complete
--

\unrestrict tmR45MCIVbLGRK8vHeR7tdxlOc4N9MiHvlBEbiKAyinW9A46ub1c5zj9rlMk9SD

