import type { RawRequest } from "./types.js";

export const sampleRequests: RawRequest[] = [
  {
    id: "sample-login",
    method: "POST",
    url: "https://demo-shop.local/api/login",
    status: 200,
    requestHeaders: {
      "content-type": "application/json"
    },
    responseHeaders: {
      "content-type": "application/json"
    },
    requestBody: {
      email: "{{TEST_USER_EMAIL}}",
      password: "{{TEST_USER_PASSWORD}}"
    },
    responseBody: {
      token: "sample-token",
      user: {
        id: "u_1001",
        name: "Demo QA"
      }
    },
    durationMs: 146,
    source: "sample"
  },
  {
    id: "sample-me",
    method: "GET",
    url: "https://demo-shop.local/api/me",
    status: 200,
    requestHeaders: {
      authorization: "Bearer {{TEST_USER_TOKEN}}"
    },
    responseHeaders: {
      "content-type": "application/json"
    },
    responseBody: {
      id: "u_1001",
      email: "qa@example.com",
      role: "buyer"
    },
    durationMs: 92,
    source: "sample"
  },
  {
    id: "sample-products",
    method: "GET",
    url: "https://demo-shop.local/api/products?page=1&keyword=phone",
    status: 200,
    requestHeaders: {},
    responseHeaders: {
      "content-type": "application/json"
    },
    responseBody: {
      items: [
        {
          id: "p_1001",
          name: "Aurora Phone",
          price: 699
        }
      ],
      total: 1
    },
    durationMs: 188,
    source: "sample"
  },
  {
    id: "sample-cart",
    method: "POST",
    url: "https://demo-shop.local/api/cart/items",
    status: 201,
    requestHeaders: {
      authorization: "Bearer {{TEST_USER_TOKEN}}",
      "content-type": "application/json"
    },
    responseHeaders: {
      "content-type": "application/json"
    },
    requestBody: {
      productId: "p_1001",
      quantity: 1
    },
    responseBody: {
      cartId: "c_1001",
      itemCount: 1
    },
    durationMs: 171,
    source: "sample"
  },
  {
    id: "sample-order",
    method: "POST",
    url: "https://demo-shop.local/api/orders",
    status: 201,
    requestHeaders: {
      authorization: "Bearer {{TEST_USER_TOKEN}}",
      "content-type": "application/json"
    },
    responseHeaders: {
      "content-type": "application/json"
    },
    requestBody: {
      cartId: "c_1001",
      addressId: "addr_001"
    },
    responseBody: {
      orderId: "o_1001",
      status: "created"
    },
    durationMs: 241,
    source: "sample"
  }
];

