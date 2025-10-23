#!/usr/bin/env python3
"""
Convert the combined dataset into T3C's expected CSV format.

T3C expects these columns:
- comment (required): The actual text content
- id (required): Unique identifier
- interview (optional): Speaker/interview identifier
- video (optional): Video URL
- timestamp (optional): Timestamp in video

This script offers two options:
1. Basic: Just map to T3C columns, discard metadata
2. Enhanced: Embed metadata into interview name for LLM context
"""

import csv
import sys
import argparse

def create_basic_csv(input_csv, output_csv):
    """
    Create basic T3C CSV with just the required/expected columns.
    Metadata is discarded.
    """
    with open(input_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []

        for row in reader:
            rows.append({
                'id': row['comment-id'],
                'interview': row['interview'],
                'timestamp': row['timestamp'],
                'comment': row['comment-body']
            })

    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['id', 'interview', 'timestamp', 'comment']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)

def create_enhanced_csv(input_csv, output_csv):
    """
    Create enhanced T3C CSV with metadata embedded in interview name.

    Interview format: "Name (Agency - Role, X years)"
    This gives the LLM context without extra columns.
    """
    with open(input_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []

        for row in reader:
            # Build enhanced interview name with metadata
            interview_base = row['interview']
            agency = row['agency']
            role = row['role']
            service = row['length_of_service']

            # Only add metadata if we have it and it's not N/A
            if agency != 'N/A' or role != 'N/A':
                parts = []
                if agency != 'N/A':
                    parts.append(agency)
                if role != 'N/A':
                    parts.append(role)

                metadata = ' - '.join(parts)
                if service != 'N/A':
                    metadata += f', {service}'

                interview_enhanced = f"{interview_base} ({metadata})"
            else:
                interview_enhanced = interview_base

            rows.append({
                'id': row['comment-id'],
                'interview': interview_enhanced,
                'timestamp': row['timestamp'],
                'comment': row['comment-body']
            })

    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['id', 'interview', 'timestamp', 'comment']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)

def main():
    parser = argparse.ArgumentParser(
        description='Convert combined dataset to T3C CSV format'
    )
    parser.add_argument(
        'input_csv',
        help='Input CSV file (disaster_dialogues_combined.csv)'
    )
    parser.add_argument(
        '--basic',
        action='store_true',
        help='Create basic CSV (discard metadata)'
    )
    parser.add_argument(
        '--enhanced',
        action='store_true',
        help='Create enhanced CSV (embed metadata in interview name)'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output filename (default: auto-generated based on mode)'
    )

    args = parser.parse_args()

    # Default to enhanced if neither specified
    if not args.basic and not args.enhanced:
        args.enhanced = True

    # Determine output filename
    if args.output:
        output_csv = args.output
    elif args.basic:
        output_csv = args.input_csv.replace('.csv', '_t3c.csv')
    else:
        output_csv = args.input_csv.replace('.csv', '_t3c_enhanced.csv')

    print("="*60)
    print("Converting to T3C Format")
    print("="*60)
    print(f"Input:  {args.input_csv}")
    print(f"Output: {output_csv}")
    print(f"Mode:   {'Basic' if args.basic else 'Enhanced'}")
    print()

    if args.basic:
        count = create_basic_csv(args.input_csv, output_csv)
        print(f"Created basic T3C CSV with {count} rows")
        print()
        print("Columns: id, interview, timestamp, comment")
        print("Metadata discarded: agency, role, length_of_service, question")
    else:
        count = create_enhanced_csv(args.input_csv, output_csv)
        print(f"Created enhanced T3C CSV with {count} rows")
        print()
        print("Columns: id, interview, timestamp, comment")
        print("Metadata embedded in interview name")
        print('Example: "Ann USDA (USDA - National Program Leader, 5 years)"')

    print()
    print(f"✓ Ready for T3C upload: {output_csv}")
    print("="*60)

if __name__ == "__main__":
    main()
