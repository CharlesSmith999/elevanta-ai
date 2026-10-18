# CRM Decisions v1.27: browser bundle splitting

Date: 2026-10-18
Status: Implemented and ready for release

The web build now separates charting, icon, and application code into browser chunks. The main application bundle is reduced from approximately 1.12 MB to approximately 648 KB before compression, and the chart library is loaded as its own cacheable chunk. No product behavior, data, permissions, or routing changed.
