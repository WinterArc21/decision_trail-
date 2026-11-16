// Fictional meetings at Kestrel, a B2B software company, while it ships
// "Pulse", a new analytics dashboard. The format is the same plain-text
// format users can upload: "[mm:ss] Speaker Name: what they said".

export const kickoff = `
[00:14] Maya Chen: Okay, I think everyone's here. Thanks for making time. This is the official kickoff for Pulse, so I want us to leave with a date, an architecture direction, and a rough plan for packaging.
[00:31] Daniel Okafor: Sounds good. I brought the scoping doc from last week if we need it.
[01:05] Maya Chen: Quick context for Sofia, since she was out. Pulse is the analytics dashboard. Customers see usage trends, adoption by team, and where workflows get stuck.
[01:22] Sofia Alvarez: Got it. And this is the thing the Brightwave team asks for in every QBR.
[01:30] Maya Chen: Exactly. Brightwave, Northpeak, a few others.
[03:40] Maya Chen: Let's start with timing. Sofia, what does marketing need from us?
[03:52] Sofia Alvarez: Ideally we announce at the Kestrel Summit livestream. That's October 14. If we miss that, the next good moment is basically January.
[04:10] Daniel Okafor: October 14 is tight but doable if we keep v1 focused. Five weeks of build, one week of hardening.
[04:26] Maya Chen: Then let's commit. Pulse goes GA on October 14, announced at Summit. Everyone okay with that?
[04:33] Priya Raman: Works for design.
[04:35] Leo Martins: Yep.
[04:39] Maya Chen: Great, locking it in. I'll update the roadmap after this call.
[05:02] Daniel Okafor: One thing I'd add. We should get real customers on it before Summit.
[05:15] Maya Chen: Agreed. Let's run a two-week private beta with five design partners starting September 28. Brightwave has to be one of them.
[05:29] Sofia Alvarez: I can line up the partner comms.
[09:48] Maya Chen: Okay, architecture. Leo, you've been looking at the data side.
[10:02] Leo Martins: Yeah. The simplest path is Postgres materialized views on top of the events table. We refresh every fifteen minutes. No new infrastructure, no new vendor.
[10:24] Daniel Okafor: And our median tenant is around two million events, so Postgres handles that easily.
[10:37] Leo Martins: The big ones are bigger. Brightwave is something like forty million. But I think we're fine to start.
[10:51] Daniel Okafor: I'm comfortable with that. Let's go with materialized views for v1 and revisit if we hit limits.
[11:02] Maya Chen: Decision made. Postgres materialized views, fifteen-minute refresh. Leo owns it.
[18:20] Maya Chen: Packaging. Sofia, where did you land?
[18:31] Sofia Alvarez: My recommendation is that we include Pulse in the Pro plan at no extra cost. It's a retention play. It makes Pro feel more valuable and gives sales a reason to upgrade Starter accounts.
[18:55] Daniel Okafor: No objection from engineering. Less billing work for us, honestly.
[19:06] Maya Chen: Okay. Pulse is included in Pro, no add-on. We can revisit once we see usage.
[26:40] Maya Chen: Last big one. Priya, onboarding.
[26:52] Priya Raman: The concept everyone liked in the review was the custom dashboard builder. Drag in any metric, arrange it however you want. That's the hero moment for launch.
[27:15] Daniel Okafor: It's the biggest chunk of front-end work, but if it's the hero moment, I think it's worth it.
[27:28] Maya Chen: Let's do it. We launch with the custom builder. Priya, can you have final designs by Friday?
[27:36] Priya Raman: Friday works.
[42:10] Maya Chen: Recap. GA October 14 at Summit. Beta with five partners on the 28th. Materialized views. Pulse in Pro. Custom builder at launch. I'll send notes.
`

export const weeklySync = `
[00:08] Maya Chen: Morning. Hannah's joining us today because security had questions about Pulse. Let's go around. Leo, you first. I hear you have news.
[00:20] Leo Martins: Yeah, not great news. I ran the load test against a copy of Brightwave's data over the weekend.
[00:31] Leo Martins: The materialized view refresh takes thirty-eight minutes for them. Our window is fifteen. So the dashboard would always be stale, and the refresh holds a database connection the whole time.
[00:52] Daniel Okafor: Thirty-eight minutes. Okay. That's a blocker for the large tenants, no question.
[01:01] Maya Chen: How many tenants are that size?
[01:06] Leo Martins: Eleven are over ten million events. But they're also our biggest accounts.
[01:15] Daniel Okafor: So we can't ship materialized views as they are. Leo, what are the options?
[01:24] Leo Martins: Honestly, the right tool is a columnar store. ClickHouse would chew through Brightwave's volume in seconds. But it's new infrastructure.
[01:40] Daniel Okafor: Let's not decide off a hunch. Leo, spike ClickHouse this week against the same Brightwave dataset, and we'll make the call at the readiness review.
[01:52] Leo Martins: I can do that. I'll have numbers by Monday.
[02:01] Maya Chen: Good. Spike first, decide on the 24th.
[02:30] Hannah Kim: Can I jump in here? This is exactly my question.
[02:36] Hannah Kim: If ClickHouse means a new vendor storing customer data, even ClickHouse Cloud, that triggers a SOC 2 vendor review. Our enterprise contracts require it.
[02:52] Maya Chen: How long does that take?
[02:56] Hannah Kim: Realistically three to four weeks once we kick it off. Brightwave's procurement team will ask for the report before they turn anything on.
[03:10] Daniel Okafor: So if we go with ClickHouse, October 14 is at risk.
[03:16] Hannah Kim: I'd say October 14 can't happen with a new data store unless the review is done. I'd treat it as a blocker on the date.
[03:27] Maya Chen: Okay. I don't love it, but better to know now. Let's flag the launch date as blocked until we make the architecture call.
[08:45] Maya Chen: Priya, onboarding update.
[08:52] Priya Raman: So we did the first round of design partner interviews with the prototype. Six sessions. Honestly, the custom builder isn't landing.
[09:05] Priya Raman: Four out of six people stared at the empty canvas and asked what they were supposed to build. They want to see something useful first.
[09:20] Maya Chen: Hm. That's the hero moment, though.
[09:24] Priya Raman: I know. My proposal is that we swap it. Launch with three starter templates, Adoption, Engagement, and Workflow health, and push the full builder to v1.1.
[09:41] Daniel Okafor: That also takes about two weeks off the front-end estimate, which, given everything else this morning, I'd happily take.
[09:52] Maya Chen: Okay, I'm convinced. Templates at launch, and the builder moves to v1.1. Priya, update the designs.
[10:01] Priya Raman: On it.
[27:40] Maya Chen: Recap. Materialized views are blocked for large tenants, and Leo spikes ClickHouse. The security review blocks the date if we add a vendor. Templates replace the builder. See you on the 24th.
`

export const readinessReview = `
[00:10] Maya Chen: Okay, this is the readiness review. Three things on the agenda: the architecture decision, the launch date, and Marcus asked for time on pricing.
[00:24] Maya Chen: Leo, start us off with the ClickHouse spike.
[00:30] Leo Martins: So, the results. Same Brightwave dataset. A full aggregation in ClickHouse takes about four seconds, versus thirty-eight minutes on the materialized view.
[00:44] Daniel Okafor: Four seconds.
[00:46] Leo Martins: Four seconds. p95 query latency is around 600 milliseconds on the dashboard.
[00:55] Leo Martins: But I don't think we should move everyone. For small tenants, Postgres is fine and cheaper. My proposal is hybrid. Tenants over ten million events get routed to ClickHouse, and everyone else stays on Postgres.
[01:14] Daniel Okafor: I like that. It limits the blast radius. Eleven tenants on the new store, not four hundred.
[01:22] Maya Chen: Any objections? Okay. We're going hybrid. ClickHouse for large tenants, Postgres for the rest. That clears the performance blocker.
[01:35] Leo Martins: I'll write up the routing design today.
[01:58] Maya Chen: Which brings us to the date. Hannah?
[02:04] Hannah Kim: ClickHouse Cloud means the vendor review. If we start today, I can get it done by October 23 at the earliest. October 14 isn't possible.
[02:18] Sofia Alvarez: So we miss Summit.
[02:21] Maya Chen: We miss the launch at Summit. But we could still preview it on stage, just not make it available yet.
[02:31] Sofia Alvarez: That actually works for me. A preview builds a waitlist.
[02:38] Daniel Okafor: If the review lands on the 23rd, I'd want a week of buffer after that.
[02:46] Maya Chen: Then let's move GA to November 3. We preview at Summit on October 14, and GA is November 3. I'll tell the design partners.
[02:57] Hannah Kim: I'll kick off the vendor review as soon as we hang up. I'll send the questionnaire to ClickHouse today.
[03:06] Maya Chen: Please do. Hannah owns the review.
[14:12] Maya Chen: Marcus, pricing.
[14:16] Marcus Bell: Thanks. So I've had Pulse in front of three enterprise prospects this month. All three asked what it costs. They expect to pay for it.
[14:30] Marcus Bell: If we give the full thing away in Pro, we're leaving real money on the table. Especially the large-tenant performance, which is literally what we're paying ClickHouse for.
[14:45] Sofia Alvarez: I still want Pro to get something. That was the whole retention argument.
[14:52] Marcus Bell: Totally fair. So split it. Pro gets core Pulse with the three templates. Enterprise gets an add-on, eight dollars a seat, with the ClickHouse tier, exports, and longer history.
[15:10] Maya Chen: I like that it maps to the architecture. Sofia?
[15:15] Sofia Alvarez: I can live with it. Core in Pro, advanced as an add-on.
[15:20] Maya Chen: Okay, we're changing what we decided at kickoff. Core Pulse stays in Pro, and advanced Pulse becomes an eight-dollar Enterprise add-on. Marcus and Sofia own the pricing page.
[47:30] Maya Chen: Recap. Hybrid architecture. GA moves to November 3, with a preview at Summit. Hannah's running the vendor review. Pricing is now core in Pro plus an Enterprise add-on.
`

export const goNoGo = `
[00:09] Maya Chen: Go/no-go for November 3. Let's go function by function. Hannah, the review.
[00:16] Hannah Kim: Good news. The SOC 2 vendor review for ClickHouse Cloud was approved on Friday. The report is in the trust portal, and I already sent it to Brightwave's procurement team.
[00:31] Maya Chen: That's huge, thank you. So the compliance blocker is officially cleared.
[00:36] Hannah Kim: Cleared. Security is a go.
[00:48] Maya Chen: Leo, data.
[00:52] Leo Martins: The hybrid store is running in staging with all eleven large tenants. p95 is 820 milliseconds, under our 900 target. Small tenants are unchanged on Postgres.
[01:08] Daniel Okafor: We also tested failover. If ClickHouse is down, large tenants fall back to a cached snapshot.
[01:16] Maya Chen: So we ship it?
[01:18] Daniel Okafor: We ship it. The routing threshold stays at ten million events.
[01:24] Maya Chen: Great. Data is a go.
[04:40] Maya Chen: Pricing. Marcus?
[04:44] Marcus Bell: The pricing page is ready. One problem, though. Our billing system can't meter add-on seats yet. Finance says the billing update lands mid-November.
[04:58] Daniel Okafor: So on November 3 we literally can't charge for the add-on.
[05:03] Marcus Bell: Right. It's blocking the Enterprise add-on, not the launch.
[05:10] Maya Chen: Okay, let's keep that as an open blocker. Daniel, can you confirm the billing date with finance by Friday?
[05:16] Daniel Okafor: Yep, I'll chase it.
[09:30] Maya Chen: Priya, anything on onboarding?
[09:35] Priya Raman: Templates are done and tested well in the beta. Seven of eight partners built their first dashboard in under two minutes.
[09:47] Priya Raman: The one thing people still ask for is the custom builder. So I want to add a "Request a custom dashboard" button inside the templates, so we can see which metrics people want before we build v1.1.
[10:02] Maya Chen: Love that. Let's add the request button. It's small, and it gives us data for v1.1.
[31:05] Maya Chen: Okay, final call. Security is a go, data is a go, onboarding is a go. Pricing has the billing blocker, but it doesn't stop GA.
[31:18] Maya Chen: So it's a go. We launch November 3 with a staged rollout. Ten percent of accounts on day one, everyone by November 10.
[31:30] Daniel Okafor: Engineering's a go.
[31:32] Sofia Alvarez: Marketing's ready.
[31:35] Maya Chen: Then we're shipping. Nice work, everyone.
`

/** Not pre-analyzed: offered in the upload dialog so people can try live extraction. */
export const retroExample = `[00:12] Maya Chen: Welcome to the Pulse retro. We're nine days past GA, so let's look at what happened and decide what's next.
[00:30] Daniel Okafor: Quick headline. The staged rollout finished on November 10 as planned. Every account has Pulse now.
[01:05] Daniel Okafor: The other big one: the billing update went live yesterday, so we can finally meter add-on seats.
[01:20] Marcus Bell: Then let's start charging for the Enterprise add-on on December 1. That gives current customers three weeks of notice.
[01:31] Maya Chen: Agreed. We'll start billing the add-on on December 1.
[03:10] Leo Martins: Heads up, there's a blocker. ClickHouse costs are running forty percent over budget because of the export jobs.
[03:24] Leo Martins: I can't fix it until ClickHouse Cloud support gives us access to the query logs.
[03:40] Daniel Okafor: I'll escalate with our account manager today.
[06:15] Priya Raman: The request button worked. We got 212 custom dashboard requests in the first week, and most of them ask for the same five metrics.
[06:34] Priya Raman: So I'd like to change the plan for v1.1. Instead of the full drag-and-drop builder, we ship a lighter builder with those five metrics first.
[06:50] Maya Chen: That makes sense. Let's go with the lighter builder for v1.1.
[09:02] Hannah Kim: Two enterprise customers asked for EU data residency for the ClickHouse tier. It would need its own security review.
[09:20] Maya Chen: Let's not commit to EU data residency this quarter. We'll revisit it in January.
[12:40] Maya Chen: Great retro. Recap: add-on billing starts December 1, Leo is blocked on the query logs, a lighter builder for v1.1, and EU residency waits until January.
`
