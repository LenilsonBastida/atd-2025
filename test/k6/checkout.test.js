import http from 'k6/http';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';
import { generateRandomEmail } from './helpers/email.js';
import { getBaseUrl } from './helpers/baseURL.js';
import { login } from './helpers/login.js';
import faker from "k6/x/faker";

export let options = {
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        'checkout_duration': ['p(95)<2000'],
    },
    stages: [
        { duration: '3s', target: 10 }, // Ramp up
        { duration: '15s', target: 10 }, // Average
        { duration: '2s', target: 100 }, // Spike
        { duration: '3s', target: 100 }, // Spike
        { duration: '5s', target: 10 }, // Average
        { duration: '5s', target: 0 }, // Ramp up 
    ]
};

const checkoutTrend = new Trend('checkout_duration');

export default function () {
    let email, password, token;
    group('register', () => {
        email = generateRandomEmail();
        password = faker.internet.password();
        const name = faker.person.firstName();
        const url = `${getBaseUrl()}/auth/register`;
        const payload = JSON.stringify({ email, password, name });
        const params = { headers: { 'Content-Type': 'application/json' } };
        const res = http.post(url, payload, params);
        check(res, {
            'register status 201': (r) => r.status === 201,
        });
    });

    group('login', () => {
        token = login(email, password);
    });

    group('checkout', () => {
        const url = `${getBaseUrl()}/checkout`;
        const payload = JSON.stringify({
            productId: 1,
            quantity: 1,
            paymentMethod: 'cash',
        });
        const params = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        };
        const res = http.post(url, payload, params);
        checkoutTrend.add(res.timings.duration);
        check(res, {
            'checkout status 201': (r) => r.status === 201,
        });
    });
}
