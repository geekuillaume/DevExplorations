---
title: 'Getting per-request context in NodeJS with async_hooks'
date: '2019-03-04'
spoiler: 'Getting one awesome feature from PHP in NodeJS: per-request context'
---

I recently got a problem when I was building a HTTP server in NodeJS. I'm logging things in a lot of places inside my codebase and I have a unique ID for each request. I want to append this ID to each of my log messages to trace what's happening in each request. How to efficiently do this?

The simplest way is to pass this request ID as an argument in each of my functions. The problem with this is that it's not maintainable: if I'm 5 functions deep in my stack and I want to log something, I need to edit 5 functions to add an argument and edit every function call.

You can make sure to always pass a "context" object in every one of your function but there is still a problem. I'm using a SQL lib which can be configured to run a function when a long query is detected but this function is called only with the query string. I cannot pass my request context to it.

If you are ready to use experimental NodeJS stuff, I have a really elegant solution for you thanks to [async_hooks](https://nodejs.org/api/async_hooks.html).

## Some theory about async_hooks

The `async_hooks` module expose functions to track asynchronous resources. These hooks are called whenever a `setTimeout`, server listener or any other asynchronous task is created, started, finished and destroyed.

When an asynchronous resource is created, a new `asyncId` will be assigned to it and our `init` hook will be called with this id and the `asyncId` of the parent resource. This module also exposes a very useful `executionAsyncId()` method to get the current `asyncId` of our function execution.

Here's how we can use it to simply log a message when the hooks are called:

```js
const fs = require('fs');
const async_hooks = require('async_hooks');

const log = (str) => fs.writeSync(1, `${str}\n`);

async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    log(`INIT: asyncId: ${asyncId} / type: ${type} / trigger: ${triggerAsyncId}`);
  },
  destroy(asyncId) {
    log(`DESTROY: asyncId: ${asyncId}`);
  },
}).enable();
```

> You may notice we are not using `console.log` here. It's because `console.log` is an asynchronous operation and would trigger a hook which will call `console.log` which is an asynchronous operation and would trigger a hook... And this is a case of an infinite loop. The solution is to use `fs.writeSync` which is synchronous and will not trigger one of our hooks.

Let's try these hooks with a simple `setTimeout` example in which we are logging the current `asyncId` outside and inside the `setTimeout`:

```js
log(`>> Calling setTimeout: asyncId: ${async_hooks.executionAsyncId()}`);
setTimeout(() => {
  log(`>> Inside setTimeout callback: asyncId: ${async_hooks.executionAsyncId()}`);
}, 0);
log(`>> Called setTimeout: asyncId: ${async_hooks.executionAsyncId()}`);
```

When executing this code, we'll get this output:

```
>> Calling setTimeout: asyncId: 1
INIT: asyncId: 2 / type: Timeout / trigger: 1
>> Called setTimeout: asyncId: 1
>> Inside setTimeout callback: asyncId: 2
DESTROY: asyncId: 2
```

Let's see what happened here.
- We started with an `asyncId` equal to 1 and called `setTimeout`.
- It created a `Timeout` asynchronous resource and triggered our `init` hook with the newly created `asyncId` of 2 and its parent `asyncId` of 1.
- We logged the end of our program with an `asyncId` still equals to 1
- The `Timeout` resource callback was called and we logged the current `asyncId` which is equals to 2
- The `Timeout` resource was destroyed and our `destroy` hook was triggered

There are also two other hooks: `before` and `after`. They can be used to monitor the timings of some asynchronous resources like external HTTP requests or SQL queries.

## Okay, but what's the point?

With `executionAsyncId()` and the `init` we can recreate a "stack" of our functions calls even if they were asynchronous.

Here's a real example. We are creating a HTTP server, reading and sending the content of a `test.txt` file on each request.

```js
const fs = require('fs');
const async_hooks = require('async_hooks');
const http = require('http');

const log = (str) => fs.writeSync(1, `${str}\n`);

async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    log(`asyncId: ${asyncId} / trigger: ${triggerAsyncId}`);
  },
}).enable();

const readAndSendFile = (res) => {
  fs.readFile('./test.txt', (err, file) => {
    log(`>> Inside readAndSendFile: execution: ${async_hooks.executionAsyncId()}`);
    res.end(file);
  });
}

const requestHandler = (req, res) => {
  log(`>> Inside request: execution: ${async_hooks.executionAsyncId()}`);
  readAndSendFile(res);
}

const server = http.createServer(requestHandler);

server.listen(8080);
```

Let's execute this code and send two requests. I removed some useless lines from the output.

```
>> Inside request: execution: 6
asyncId: 9 / trigger: 6
asyncId: 11 / trigger: 9
asyncId: 12 / trigger: 11
asyncId: 13 / trigger: 12
>> Inside readAndSendFile: execution: 13
[...]
>> Inside request: execution: 31
asyncId: 34 / trigger: 31
asyncId: 36 / trigger: 34
asyncId: 37 / trigger: 36
asyncId: 38 / trigger: 37
>> Inside readAndSendFile: execution: 38
```

We see that our two requests were assigned two `asyncId`: 6 and 31. Reading our file created new async resources transparent to our code and then our `readAndSendFile` logged two `asyncId`: 13 and 38.

From the `readAndSendFile` function, we can get our original request `asyncId` by retracing our "async path". For example, for our first request, we start with an `asyncId` equals to 13 and then we get 13 → 12 → 11 → 9 → 6.


## Getting something useful

With all of these, we can create two functions to create and get a context object for each of our requests. This can also be used for any other usage, not only HTTP server.

```js
const async_hooks = require('async_hooks');

const contexts = {};

async_hooks.createHook({
  init: (asyncId, type, triggerAsyncId) => {
    // A new async resource was created
    // If our parent asyncId already had a context object
    // we assign it to our resource asyncId
    if (contexts[triggerAsyncId]) {
      contexts[asyncId] = contexts[triggerAsyncId];
    }
  },
  destroy: (asyncId) => {
    // some cleaning to prevent memory leaks
    delete contexts[asyncId];
  },
}).enable();


function initContext(fn) {
  // We force the initialization of a new Async Resource
  const asyncResource = new async_hooks.AsyncResource('REQUEST_CONTEXT');
  return asyncResource.runInAsyncScope(() => {
    // We now have a new asyncId
    const asyncId = async_hooks.executionAsyncId();
    // We assign a new empty object as the context of our asyncId
    contexts[asyncId] = {}
    return fn(contexts[asyncId]);
  });
}

function getContext() {
  const asyncId = async_hooks.executionAsyncId();
  // We try to get the context object linked to our current asyncId
  // if there is none, we return an empty object
  return contexts[asyncId] || {};
};

module.exports = {
  initContext,
  getContext,
};
```

Let's write a small test to check if it's all working right.

```js
const {initContext, getContext} = require('./context.js');

const logId = () => {
  const context = getContext();
  console.log(`My context id is: ${context.id}`);
}

initContext((context) => {
  context.id = 1;
  setTimeout(logId, 100);
  setTimeout(logId, 300);
});

initContext((context) => {
  context.id = 2;
  setTimeout(logId, 200);
  setTimeout(logId, 400);
});
```

By executing this we get:

```
My context id is: 1
My context id is: 2
My context id is: 1
My context id is: 2
```

## What's next?

With these two functions we implemented a simple but very useful way to create a context to store data between our function without having to pass these data as arguments.

A real-life usage would be creating a context for each HTTP request, generating a request ID and fetching this ID inside our logging function to print it on each line. I've also used it to run every database call of one HTTP request in the same SQL transaction.

You should be careful about how much information you include in your context. This should be kept as simple as possible to keep the data flow in your program simple to understand and prevent edge cases which can create bugs. Using this kind of context will also confuse tools like TypeScript which won't be able to know what's in your current context.

Keep in mind that the `async_hooks` is still experimental but if you like to live on the edge, go and try it!
