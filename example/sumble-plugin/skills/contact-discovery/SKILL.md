---
name: "contact-discovery"
description: "Find people, contacts, and buyer-side context at the right accounts."
---

<!-- pluxx:generated:start -->
# Contact Discovery

Find people, contacts, and buyer-side context at the right accounts.

## Tools In This Skill

### `AddContactsToList`

Add people to an existing contact list.

    Accepts Sumble person IDs. Returns how many were added,
    how many were already on the list, and the list url.
    Duplicates are silently skipped. Always surface the url
    to the user so they can view the list in Sumble.

    WORKFLOW — when a user provides names or LinkedIn URLs:
    1. Call find_people to resolve them to Sumble person
       IDs.
    2. Call add_contacts_to_list with the matched IDs
       (use the "id" field from each result).

    If you already have Sumble person IDs (from a prior
    API call), pass them directly as people_ids.

    Args:
        reason: Why you are calling this tool.
        list_id: The contact list ID (from
            list_contact_lists or create_contact_list).
        people_ids: Sumble person IDs to add.
    

Inputs:
- `reason` (string, required)
- `list_id` (integer, required)
- `people_ids` (array, required)

### `CreateContactList`

Create a new contact list (people list).

    Returns the new list's id, name, and url. Always
    surface the url to the user so they can view the
    list in Sumble. Use add_contacts_to_list to populate
    it afterward.

    WORKFLOW — when a user wants to build a people list:
    1. Call find_people or find_related_people_to_person
       to get Sumble person IDs.
    2. Call create_contact_list to make the list.
    3. Call add_contacts_to_list with the person IDs.

    If you already have Sumble person IDs (from a prior
    API call), skip step 1 and use those IDs directly.

    Always ask the user for the list name. If you have a
    good guess, you can suggest it in the prompt.

    Args:
        reason: Why you are calling this tool.
        name: Name for the new list.
    

Inputs:
- `reason` (string, required)
- `name` (string, required)

### `EnrichPerson`

Enrich a person with contact information (email).

    The response includes a `url` field with a link to the
    person's full profile on Sumble. Always show this URL
    to the user so they can view more details.

    Costs 10 credits if contact info is found.
    Free if the data is already cached or not available
    from the provider.

    If you get a 402 error, the user needs more credits.
    Direct them to https://sumble.com/account/purchase

    Args:
        person_id: The Sumble person ID to enrich.
        reason: Why you are calling this tool.
    

Inputs:
- `person_id` (integer, required)
- `reason` (string, required)

### `FindRelatedPeopleToJob`

Find people related to a job listing.

    Given a job ID, returns relevant people such as hiring
    managers and team members at the organization.

    Always include the url If results include URLs or links, always share them
    with the user.

    Costs 1 credit per person returned. If you get a 402
    error, the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        reason: Why you are calling this tool.
        job_id: The job post ID to find related people for.
        limit: Max results (1-100, default 10)
        offset: Skip N results (default 0)
    

Inputs:
- `reason` (string, required)
- `job_id` (integer, required)
- `limit` (integer)
- `offset` (integer)

### `FindRelatedPeopleToPerson`

Find people related to a specific person.

    Returns people at the same organization who share
    features with the given person (technologies, job
    functions, teams, locations). Each result includes
    a `direction` field: "above" or "below" indicating
    the person's position relative to the source person
    in the org hierarchy.

    If results include URLs or links, always share them
    with the user.

    Costs 1 credit per person returned. If you get a 402
    error, the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        person_id: The ID of the person to find
            related people for.
        reason: Why you are calling this tool.
        limit: Max results (1-100, default 10)
        offset: Skip N results (default 0)
    

Inputs:
- `person_id` (integer, required)
- `reason` (string, required)
- `limit` (integer)
- `offset` (integer)

### `GetContactList`

Get one contact list and its people.

    Fetch a list by id after calling list_contact_lists.
    Returns list metadata (including url) and simplified
    person data: id, name, job_title, job_function,
    linkedin_url, organization info, and contact_info
    (emails/phone) if the contact was enriched. Each
    person entry includes a `url` linking to their
    Sumble profile for more details. Always show these
    URLs and the list url to the user.

    Costs 1 credit per returned person. If you get a 402
    error, the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        list_id: The contact list ID (from list_contact_lists).
        reason: Why you are calling this tool.
    

Inputs:
- `list_id` (integer, required)
- `reason` (string, required)

### `ListContactLists`

List the user's contact lists (people lists).

    Returns metadata for each list: id, name, people_count,
    and url. Always surface the url to the user so they can
    view the list in Sumble.
    Use get_contact_list after this to retrieve the people in a
    specific list.

    Costs 1 credit per returned list. If you get a 402 error,
    the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        reason: Why you are calling this tool.
    

Inputs:
- `reason` (string, required)

## Example Requests

- "Create a new contacts to list with <reason>."
- "Create a new contact list with <reason>."
- "Find enrich persons using <person_id>."
- "Find related people to jobs with <reason>."
- "Find related people to persons using <person_id>."
- "Look up a contact list using <list_id>."
- "List contact lists with <reason>."

## Usage

- Pick the most specific tool in this skill for the user request.
- Gather required inputs before calling a tool.
- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.
<!-- pluxx:generated:end -->

## Custom Notes

<!-- pluxx:custom:start -->
Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
