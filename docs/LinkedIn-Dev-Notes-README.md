Back to main README: [click here](../README.md)

## Resources

- V1 Docs: https://linkedin.api-docs.io
- V2 Docs:
    - https://docs.microsoft.com/en-us/linkedin/
    - https://developer.linkedin.com/docs/guide/v2
- Other projects that use the unofficial Voyager API:
    - [tomquirk/linkedin-api](https://github.com/tomquirk/linkedin-api)
    - [eilonmore/linkedin-private-api](https://github.com/eilonmore/linkedin-private-api)
    - [jarivas/linkedin-exporter](https://github.com/jarivas/linkedin-exporter)
- LinkedIn DataHub (this powers a lot of the backend)
    - [DataHub Blog Post](https://engineering.linkedin.com/blog/2019/data-hub)
    - [DataHub Github Repo](https://github.com/linkedin/datahub)
- LinkedIn `Rest.li` (also powers some of the backend)
    - [`Rest.li` GitHub Repo](https://github.com/linkedin/rest.li/)
    - [`Rest.li` Docs](https://linkedin.github.io/rest.li/spec/protocol)

## Internal API (aka *Voyager*)
### Query String Syntax
One common way that different pieces of information are requested from Voyager is simply by using different endpoints; `/me` for information about the logged-in user, `/identity/profiles/.../skillCategory` for skills, etc.

However, certain endpoints have advanced filtering in place, where there is another layer of passing request data - through the **query string**. The syntax and nature of filtering sort of feels like GraphQL or something like that. Especially since these endpoints will sometimes even return `schema` info, which describes the shape of the actual data that is being returned.

The syntax varies, but as of 2020, the more advanced filtered endpoints usually look like this:

`{endpoint}/?q={authOrObjectOfInterest}&authOrObjectOfInterest={authOrObjectOfInterest_VALUE}&decorationId={schemaFilter}`

To break this down further:

 - `q={authOrObjectOfInterest}`
     - This can be either *who* is authorizing the request (e.g. `admin`, `viewee`, etc.), or *what* the request is about (e.g. `memberIdentity`, if about another LI user)
 - `authOrObjectOfInterest={authOrObjectOfInterest_VALUE}`
     - If the endpoint uses the `q=` param (described above), the value for the query is usually passed by repeating the `authOrObjectOfInterest` string, as part of a new param key-pair.
     - For example, if the first part of the query string was `q=memberIdentity`, then the next part might be `&memberIdentity=joshuatz`. This says that the query is about a member, with the ID of `joshuatz`.
 - `decorationId={schemaFilter}`
     - For endpoints that are *generic* base endpoints, and rely heavily on schema filtering, this property is extremely important. Unfortunately, it is also extremely un-documented....
     - `schemaFilter` is a string, written with dot notation, which looks like some sort of nested namespace. E.g. `com.linkedin.voyager.dash.deco.identity.profile.PrimaryLocale-3`


> For some endpoints, only `decorationId` is required, and the other query parameters are completely omitted. Keep in mind that LI knows who is making the request based on the Auth headers.

#### GraphQL Endpoints
It looks LinkedIn has been transitioning some page components to pull data from special endpoints flavored with GraphQL. For example, `voyagerIdentityGraphQL`.

Using these requires knowing a special `queryId` value ahead of time - this could be (maybe?) a server-side generated ID for an allowed query. Getting this ID is... tricky. Short answer is that it relies on some particulars of how LI is using Ember and bundling.

Here is a quickly cobbled-together function to extract a queryId based on a known registered component path:

```js
/**
 * Retrieve a GraphQL ID for a pre-registered query (?)
 * WARNING: This relies heavily on LI internal APIs - not stable, and should be avoided when other alternatives
 * can be used instead
 * @param {string} graphQlModuleString - The module path specifier that the GraphQL query is "registered" under. For example, `graphql-queries/queries/profile/profile-components.graphq`
 */
function getGraphQlQueryId(graphQlModuleString) {
    if (typeof window.require === 'function') {
        const frozenRegisteredQuery = window.require(graphQlModuleString);
        return window.require('@linkedin/ember-restli-graphql/-private/query').getGraphQLQueryId(frozenRegisteredQuery);
    }
    return undefined;
}
```

### Protocol Versions
Voyager, like the main LinkedIn API, can use different "protocol versions" of the REST API. You might run into issues with certain endpoints and query string formats if you don't specify the correct version via the `x-restli-protocol-version` header. E.g., the `voyagerIdentityGraphQL` endpoint should probably always use the v2 header:

```
x-restli-protocol-version: 2.0.0
```

For more details, see the [official API docs for Protocol Versions](https://docs.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version).

### Paging Data
#### Paging in Requests
The usual paging querystring parameters are:

 - `count={number}`
     - I think most APIs would call this `limit` instead
 - `start={number}`

#### Paging in Responses
LI usually responds with paging data in every response, regardless if there is enough entities to need paging anyways. Paging data can be returned at multiple levels; at both the root level (for the *thing* you requested), as well as at multiple nested sub-levels (for *children* of the *thing* you requested).

The paging information object usually looks like this:

```ts
type PagingInfo = {
    count: number;
    start: number;
    total?: number;
    $recipeTypes?: string[];
    // I've never actually seen this property populated...
    // This is probably actually `Array<com.linkedin.restli.common.Link>`
    links?: string[];
}
```

> Note that several paging properties are often omitted.

### Dash Endpoint(s)
As a quick side-note, I've noticed that a lot of the endpoints with `dash` anywhere in the path use the newer `decorationId` query syntax. This seems to also correspond with a shift in LI's UI towards true SPA functionality, where more of the page is lazy-loaded with filtered data that is slotted into Ember JS templates.

### Voyager Responses and Nested Data
Here are some quick notes on Voyager responses and how data is grouped / nested:

 - *Elements* can be nested several layers deep; you might have an initial collection of elements, where each sub-element is actually a group that contains pointer to further collections of elements
     - If you want to get the final layer of elements, you have to be careful about how you get them
        - If you simply filter by `$type`, you are going to get elements out of order, and LI does not provide indexes (typically) on elements
        - The only way to preserve the true order (which will match the rendered result on LI) is to traverse through levels
     - Currently, `com.linkedin.restli.common.CollectionResponse` seems to be used for each layer where the element is a collection that points to sub elements (under `*elements`) key
     - This can also make paging a little messy.
 - LI has limits on certain endpoints, and the amount of nested elements it will return
     - See [PR #23](https://github.com/joshuatz/linkedin-to-jsonresume/pull/23) for an example of how this was implemented

### Voyager - Misc Notes
 - Make sure you always include the `Host` header if making requests outside a web browser (browsers will automatically include this for you)
     - Value should be: `www.linkedin.com`
     - If you forget it, you will get 400 error (`invalid hostname`)
 - For inline data, `<code></code>` with request payload usually ***follows*** `<img><code></code>` with *response* payload
 - It appears as though whatever language the profile was ***first*** created with sticks as the "principal language", regardless if user changes language settings (more on this below).
     - You can find this under the main profile object, where you would find `supportedLocales` - the default / initial locale is under - `defaultLocale`

### Voyager - Multilingual and Locales Support
> LI seems to be making changes related to this; this section might not be 100% up-to-date.

There are some really strange quirks around multi-locale profiles. When a multi-locale user is logged in and requesting *their own* profile, LI will *refuse* to let the `x-li-lang` header override the `defaultLocale` as specified by the profile (see [issue #35](https://github.com/joshuatz/linkedin-to-jsonresume/issues/35)). However, if *someone else* exports their profile, the same exact endpoints will respect the header and will return the correct data for the requested locale (assuming creator made a version of their profile with the requested locale).

Even stranger, this quirk only seems to apply to *certain* endpoints; e.g. `/me` respects the requested language, but `/profileView` does not (and *always* returns data corresponding with `defaultLocale`) 🙃

Furthermore, the `/dash` subset of endpoints does not ever (AFAIK) change the main key-value pairs based on `x-li-lang`; instead, it nests multi-locale data under `multiLocale` prefixed keys. For example:

```json
{
    "firstName": "Алексе́й",
    "multiLocaleFirstName": {
        "ru_RU": "Алексе́й",
        "en_US": "Alexey"
    }
}
```

## LinkedIn TS Types
I've put some basics LI types in my `global.d.ts`. Eventually, it would be nice to re-write the core of this project as TS, as opposed to the current VSCode-powered typed JS approached.
