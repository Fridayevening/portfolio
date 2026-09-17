# Uniubi module audit

> Status: source-reviewed  
> Reviewed: 2026-09-17  
> Purpose: replace unsupported website module counts with traceable product scope.

## UstarCloud

The consolidated overseas feature list records these top-level areas:

1. Personnel management.
2. Device management.
3. Authorisation management.
4. Entry and recognition records.
5. Holidays.
6. Access control.
7. Attendance management.
8. Reports.
9. Visitor management.
10. Permission and system settings.
11. Meeting management.
12. OA approval management.
13. Integration platform and open APIs.
14. Operation logs.

The source supports a broad enterprise-administration platform, but it does not support the old website's standalone `15 admin modules` headline without defining a different counting rule. Release 1 should describe the module groups instead of publishing a numeric total.

Source:

- `01Datesource/03Work-UniUbi/海外/操作和宣传/海外业务功能清单.xlsx`, sheet `Sheet1`, section `UstarCloud功能列表`.

## UstarMobile

The V2 requirements list records these main user areas:

- Login and company selection.
- Location-based check-in with photo and notes.
- Weekly and monthly attendance summaries.
- Check-in and visitor notifications.
- Company directory.
- Daily attendance results and attendance reports.
- Profile, company switching, notification settings and account controls.

Source:

- `01Datesource/03Work-UniUbi/海外/APP/Mobile/APP_V2.0.0_需求list_20210806.xlsx`, sheet `Sheet1`.

## UstarAccess

The V3 requirements list explicitly describes migration and expansion from UstarMobile. Its main product areas are:

- Remote door opening and device-access requests.
- Location-based attendance, attendance results and reports migrated from UstarMobile.
- Meeting-room booking and meeting management.
- Employee profile and account controls.

Visitor functionality and reminder notifications are marked as recommendations to defer in this requirements version, so they must not be presented as confirmed released V3 functions without another source.

Source:

- `01Datesource/03Work-UniUbi/海外/APP/Access/UA V3.0.0/UstarAccess_V2.0.0_需求list_20220519.xlsx`, sheet `Sheet1`.

## Publication decision

- Do not use `15 admin modules` or `8 Mini Program modules` as release metrics.
- Explain that the China Mini Program adapted the mobile workflows from UstarMobile and UstarAccess.
- Name representative workflows instead of claiming a total: check-in, attendance, access requests and remote opening, meeting booking, notifications, directory and account controls.
- Describe UstarCloud through representative administration groups rather than an unsupported module count.
- Use only the confirmed `six major platform releases`; remove `15 major iterations in six months`.
