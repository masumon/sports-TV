#!/usr/bin/env python3
"""
Generate static legal PDFs for the site footer (one-off; run after content changes).
Requires: pip install reportlab
"""
from __future__ import annotations

import os
from textwrap import dedent

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "legal")
EFFECTIVE = "25 April 2026"
CONTACT_EMAIL = "contact@aboenterprise.com"
OPERATOR = "ABO Enterprise"
SITE = "ABO SPORTS TV LIVE"

styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "T",
    parent=styles["Heading1"],
    fontSize=16,
    spaceAfter=12,
    textColor=colors.HexColor("#1a1a2e"),
)
H2 = ParagraphStyle(
    "H2",
    parent=styles["Heading2"],
    fontSize=12,
    spaceBefore=10,
    spaceAfter=6,
    textColor=colors.HexColor("#16213e"),
)
BODY = ParagraphStyle(
    "B",
    parent=styles["Normal"],
    fontSize=10,
    leading=14,
    spaceAfter=6,
    textColor=colors.HexColor("#2d3436"),
)
SMALL = ParagraphStyle(
    "S",
    parent=styles["Normal"],
    fontSize=8,
    leading=11,
    textColor=colors.grey,
)


def P(text: str) -> Paragraph:
    return Paragraph(dedent(text).strip().replace("\n", " "), BODY)


def section(title: str) -> list:
    return [Paragraph(f"<b>{title}</b>", H2), Spacer(1, 0.1 * cm)]


def build_privacy() -> list:
    story: list = []
    story += [
        Paragraph(f"<b>Privacy Policy</b><br/>{SITE}", TITLE),
        Paragraph(f"Effective date: {EFFECTIVE}", SMALL),
        Spacer(1, 0.3 * cm),
    ]
    story += section("1. Who we are")
    story += [
        P(
            f"""
        This Privacy Policy explains how {OPERATOR} ("we", "us") processes personal
        data when you use the {SITE} website, progressive web app, and related services
        (the "Service"). {OPERATOR} is the data controller for personal data described here,
        unless stated otherwise. Contact: <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.
        """
        ),
    ]
    story += section("2. Data we collect")
    story += [
        P(
            """
        <b>2.1</b> <b>Technical and usage data:</b> e.g. IP address (which may be truncated or
        pseudonymized by infrastructure), device type, browser, approximate region, timestamps,
        pages or screens viewed, player events, and diagnostic logs needed to run and secure the Service.
        """
        ),
        P(
            """
        <b>2.2</b> <b>Preferences:</b> e.g. language, theme, or app settings stored locally in your
        browser or device where applicable.
        """
        ),
        P(
            """
        <b>2.3</b> <b>Communications:</b> if you email us, we process the content of the message
        and metadata (sender address, time) to respond and manage the relationship.
        """
        ),
        P(
            """
        <b>2.4</b> <b>Third-party streams and embeds:</b> video or audio streams and embedded content
        may be provided by third parties. Those providers may collect data per their own policies
        (e.g. for analytics, DRM, or delivery). We do not control their processing; see their notices.
        """
        ),
    ]
    story += section("3. Purposes and legal bases (where GDPR/UK GDPR applies)")
    story += [
        P(
            """
        We use personal data to: (a) provide, maintain, and improve the Service; (b) ensure security
        and prevent abuse; (c) comply with law; (d) analyze aggregate usage. Legal bases may include
        performance of a contract, legitimate interests (e.g. security, analytics in aggregate form,
        with balancing tests), and consent where required (e.g. non-essential cookies, where we ask).
        """
        ),
    ]
    story += section("4. International transfers")
    story += [
        P(
            """
        Our infrastructure, subprocessors, or content delivery networks may process data in countries
        outside your own. Where required (e.g. EEA, UK, Switzerland), we use appropriate safeguards
        such as Standard Contractual Clauses, adequacy decisions, or other lawful mechanisms, and
        you may request a summary of the safeguards.
        """
        ),
    ]
    story += section("5. Retention")
    story += [
        P(
            """
        We keep personal data only as long as needed for the purposes above, to resolve disputes,
        enforce our terms, and meet legal obligations. Log retention depends on our hosting and security
        tools and is typically limited and rotated. Email correspondence may be kept for a reasonable period.
        """
        ),
    ]
    story += section("6. Your rights")
    story += [
        P(
            """
        Depending on your location, you may have the right to: access, rectification, erasure,
        restriction of processing, data portability, objection to certain processing, and
        withdrawal of consent where processing is based on consent. In the EEA, UK, or
        similar regimes you may lodge a complaint with a supervisory authority. We will respond
        to verifiable requests in line with applicable law. California residents: see the
        "U.S. state privacy" information in our terms and contact us for CCPA/CPRA-related requests
        as applicable to our processing.
        """
        ),
    ]
    story += section("7. Security and children")
    story += [
        P(
            """
        We use appropriate technical and organizational measures to protect personal data. The Service
        is not directed at children under 16; if you believe we have collected a child's data, contact us
        and we will take steps to delete it where required.
        """
        ),
    ]
    story += section("8. Changes and contact")
    story += [
        P(
            f"""
        We may update this policy and will post the revised version with a new effective date.
        Material changes may be highlighted on the site where practicable. Questions: {CONTACT_EMAIL}.
        """
        ),
    ]
    return story


def build_terms() -> list:
    story: list = []
    story += [
        Paragraph(f"<b>Terms of Service</b><br/>{SITE}", TITLE),
        Paragraph(f"Effective date: {EFFECTIVE}", SMALL),
        Spacer(1, 0.3 * cm),
    ]
    story += section("1. Agreement")
    story += [
        P(
            f"""
        By accessing or using the Service, you agree to these Terms and our Privacy Policy. If you
        do not agree, do not use the Service. {OPERATOR} may update these Terms; continued use after
        the effective date of changes constitutes acceptance where permitted by law.
        """
        ),
    ]
    story += section("2. The Service")
    story += [
        P(
            f"""
        The Service is an information and streaming aggregation experience. Content (including
        live streams) may be sourced from third parties. {OPERATOR} does not claim ownership of
        third-party broadcasts. Availability, quality, and legality of streams in your jurisdiction
        are your responsibility to verify. The Service is provided "as is" and may change, suspend, or
        end at any time without prior notice, except where mandatory law requires notice.
        """
        ),
    ]
    story += section("3. Acceptable use")
    story += [
        P(
            """
        You will not: (a) misuse, hack, or probe the Service; (b) use automated means to
        unreasonably load our systems or scrape in violation of our technical measures; (c) use
        the Service in violation of applicable law; (d) attempt to access others' accounts
        or data without authorization. We may suspend or terminate access for breach or risk.
        """
        ),
    ]
    story += section("4. Intellectual property")
    story += [
        P(
            f"""
        {SITE} branding, user interface, software, and original materials on the site are
        protected by copyright and other rights owned by {OPERATOR} or its licensors, except
        for third-party marks and content, which remain with their owners. Your use of the Service
        under these Terms does not transfer ownership of any intellectual property to you.
        """
        ),
    ]
    story += section("5. Disclaimers")
    story += [
        P(
            """
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED WITHOUT WARRANTIES
        OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION
        OR THAT ANY STREAM OR CONTENT IS LAWFUL IN YOUR JURISDICTION.
        """
        ),
    ]
    story += section("6. Limitation of liability")
    story += [
        P(
            """
        To the maximum extent permitted by law, in no event shall the aggregate liability of
        ABO Enterprise and its affiliates, directors, and employees for claims arising from or
        related to the Service exceed the amount you paid us in the twelve (12) months before the
        claim (or, if none, one hundred (100) USD or the local equivalent). We are not liable for
        any indirect, incidental, special, consequential, or punitive damages, or for loss of
        profits, data, or goodwill, except where such exclusion is prohibited by mandatory law
        (e.g. certain consumer rights in the EEA or similar regions).
        """
        ),
    ]
    story += section("7. Indemnity")
    story += [
        P(
            f"""
        You will indemnify and hold harmless {OPERATOR} and its affiliates from claims, damages, and
        expenses (including reasonable legal fees) arising from your use of the Service, your
        content, or your violation of these Terms, to the extent permitted by law.
        """
        ),
    ]
    story += section("8. Governing law and disputes")
    story += [
        P(
            """
        These Terms are governed by the laws of the People's Republic of Bangladesh, without regard
        to its conflict of law rules, subject to any mandatory rights you have as a consumer in
        the country of your residence (including EEA, UK, or other regions where local consumer
        law cannot be waived by contract). You may also have the right to bring a dispute in the
        courts of your home country for consumer claims where applicable. For exclusive jurisdiction
        where not prohibited, you agree to the courts of competent jurisdiction in Bangladesh, unless
        a mandatory consumer right requires otherwise.
        """
        ),
    ]
    story += section("9. Contact")
    story += [
        P(
            f"Questions: <a href='mailto:{CONTACT_EMAIL}'>{CONTACT_EMAIL}</a>."
        ),
    ]
    return story


def build_license() -> list:
    story: list = []
    story += [
        Paragraph(f"<b>License</b><br/>{SITE} — open-source components", TITLE),
        Paragraph(f"Effective date: {EFFECTIVE}", SMALL),
        Spacer(1, 0.3 * cm),
    ]
    story += [
        P(
            f"""
        The {SITE} web application may include or depend on open-source software. Such components
        remain under their respective licenses. Unless otherwise stated for a specific file or
        package, the original code authored for this project and distributed in source form
        in the public repository is licensed under the MIT License (below) by {OPERATOR} and
        contributors, where the repository applies it.
        """
        ),
        Spacer(1, 0.2 * cm),
        P(
            """
        <b>MIT License (summary)</b><br/><br/>
        Copyright (c) 2026 ABO Enterprise<br/><br/>
        Permission is hereby granted, free of charge, to any person obtaining a copy of
        this software and associated documentation files (the "Software"), to deal in the Software
        without restriction, including without limitation the rights to use, copy, modify, merge,
        publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
        to whom the Software is furnished to do so, subject to the following conditions:<br/><br/>
        The above copyright notice and this permission notice shall be included in all copies or
        substantial portions of the Software.<br/><br/>
        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
        NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
        CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
        FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        """
        ),
        Spacer(1, 0.2 * cm),
        P(
            """
        <b>Third-party rights.</b> Streams, channel logos, trademarks, and other third-party materials
        displayed in or through the Service are the property of their owners and are not covered by
        the MIT license above. The Service does not grant you any right to retransmit, record, or
        redistribute such third-party content except as allowed by the applicable rightsholders
        and law.
        """
        ),
    ]
    return story


def build_international() -> list:
    story: list = []
    story += [
        Paragraph(
            f"<b>International Use and Cross-Border Notices</b><br/>{SITE}", TITLE
        ),
        Paragraph(f"Effective date: {EFFECTIVE}", SMALL),
        Spacer(1, 0.3 * cm),
    ]
    story += section("1. Purpose")
    story += [
        P(
            f"""
        This document supplements our Privacy Policy and Terms of Service for users outside or
        across multiple countries. {SITE} may be operated from and hosted in multiple regions.
        """
        ),
    ]
    story += section("2. Country-specific use")
    story += [
        P(
            """
        You are responsible for compliance with the laws and regulations of the country or territory
        from which you access the Service, including laws relating to copyright, retransmission of
        broadcasts, gambling (where sports betting content appears), and age-restricted content.
        If the Service is not legal in your jurisdiction, you must not use it.
        """
        ),
    ]
    story += section("3. European Economic Area, UK, and Switzerland")
    story += [
        P(
            """
        If you are in the EEA, United Kingdom, or Switzerland, the Privacy Policy explains how
        we process your personal data and the rights available to you (including under GDPR/UK
        GDPR, as applicable). We process data only for lawful purposes and, where we rely on
        legitimate interests, you may object in certain cases. You may contact us or, where
        appropriate, your local supervisory authority.
        """
        ),
    ]
    story += section("4. United States")
    story += [
        P(
            """
        Residents of U.S. states with comprehensive privacy laws (e.g. California) may have additional
        rights, such as access, deletion, correction, and information about data sharing, subject to
        verifiable request and certain exceptions. We do not "sell" personal information as
        that term is commonly defined in CCPA/CPRA, and we do not sell personal information of
        known minors under 16 without affirmative authorization. You may use an authorized agent
        where the law allows. Contact: see email above. If we deny a request, you may have the
        right to appeal under some state laws.
        """
        ),
    ]
    story += section("5. Export and sanctions")
    story += [
        P(
            """
        You may not use or export the Service in violation of export control or economic sanctions
        laws (including U.S. OFAC, EU, UN, and other applicable sanctions). You represent that
        you are not located in a country subject to a comprehensive embargo or on a restricted
        party list, to the extent applicable.
        """
        ),
    ]
    story += section("6. No waiver")
    story += [
        P(
            """
        Failure to enforce a provision in one country does not waive our right to enforce it
        elsewhere, except as required by applicable law. If any part of the cross-border
        terms is unenforceable in a jurisdiction, the remaining provisions stay in effect.
        """
        ),
    ]
    return story


def _write(name: str, story: list) -> str:
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    doc.build(story)
    return path


def main() -> None:
    files = [
        ("abo-sports-tv-privacy-policy.pdf", build_privacy()),
        ("abo-sports-tv-terms-of-service.pdf", build_terms()),
        ("abo-sports-tv-license.pdf", build_license()),
        ("abo-sports-tv-international-use.pdf", build_international()),
    ]
    for name, story in files:
        p = _write(name, story)
        print("Wrote", p)


if __name__ == "__main__":
    main()
