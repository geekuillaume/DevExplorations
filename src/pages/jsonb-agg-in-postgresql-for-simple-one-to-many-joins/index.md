---
title: 'Using JSONB_AGG in PostgreSQL for simple one-to-many joins'
date: '2018-08-03'
spoiler: JSON in PostgreSQL is very powerful, here's one of my favourite feature
---

I was working on a simple API last week when I needed to code a SQL query to make a simple 1-to-many join and I discovered the jsonb_agg function of PostgreSQL. And let me tell you, I use it all the time now!

Let’s take an example: a TODO list app. Each user has multiple todo lists and each todo list contains multiple todo items.

I want to create a GET /todo_lists API endpoint to fetch all the todo lists of a specific user and their associated todos. It should output something like this:

```json
[
  {
    "id": 0,
    "name": "List 1",
    "items": [{
      "id": 0,
      "name": "todo 1"
    }, {
      "id": 1,
      "name": "todo 2"
    }]
  }
]
```

To do so, I can use a classic join like this:

```sql
SELECT todo_lists.id AS todo_list_id,
       todo_lists.name,
       todo_items.id AS todo_item_id,
       todo_items.name
FROM todo_ LISTS
LEFT JOIN todo_items ON todo_items.todo_list_id = todo_lists.id;
```

And it will result in:

```
+----------------+-------------------------+----------------+-----------------------------------------------+
| todo_list_id   | name                    | todo_item_id   | name                                          |
|----------------+-------------------------+----------------+-----------------------------------------------|
| 0              | methodologies capacitor | 0              | maroon open-source                            |
| 0              | methodologies capacitor | 1              | matrix Suriname                               |
| 0              | methodologies capacitor | 2              | e-tailers Kyat                                |
| 1              | Music workforce         | 3              | violet SSL                                    |
| 1              | Music workforce         | 4              | Beauty European Unit of Account 17(E.U.A.-17) |
| 1              | Music workforce         | 5              | vortals Michigan                              |
| 2              | Concrete Fantastic      | 6              | Frozen indigo                                 |
| 2              | Concrete Fantastic      | 7              | wireless Assistant                            |
| 2              | Concrete Fantastic      | 8              | archive Denar                                 |
+----------------+-------------------------+----------------+-----------------------------------------------+
```

And then I need to write some code to group the todos in each of their list.

## Using JSONB_AGG

You can also use the JSONB_AGG function to let PostgreSQL do the grouping for you!

```sql
SELECT todo_lists.id AS id,
       todo_lists.name,
       jsonb_agg(to_jsonb(todo_items) - 'todo_list_id') AS items
FROM todo_lists
LEFT JOIN todo_items ON todo_items.todo_list_id = todo_lists.id
GROUP BY todo_lists.id;
```

And it will output:

```
+------+-------------------------+----------------------------------------------------------------------------------------------------------------------------------------------+
| id   | name                    | items                                                                                                                                        |
|------+-------------------------+----------------------------------------------------------------------------------------------------------------------------------------------|
| 0    | methodologies capacitor | [{"id": 0, "name": "maroon open-source"}, {"id": 1, "name": "matrix Suriname"}, {"id": 2, "name": "e-tailers Kyat"}]                         |
| 1    | Music workforce         | [{"id": 3, "name": "violet SSL"}, {"id": 4, "name": "Beauty European Unit of Account 17(E.U.A.-17)"}, {"id": 5, "name": "vortals Michigan"}] |
| 2    | Concrete Fantastic      | [{"id": 6, "name": "Frozen indigo"}, {"id": 7, "name": "wireless Assistant"}, {"id": 8, "name": "archive Denar"}]                            |
+------+-------------------------+----------------------------------------------------------------------------------------------------------------------------------------------+
```

I then return that to my API client, no other changes needed!

I also used the  `-  'todo_list_id'` here to remove a field from the JSON output.

What other small SQL tips are you using currently?

Comments on [HackerNews](https://news.ycombinator.com/item?id=17679365).