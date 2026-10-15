import base64
import binascii
import copy

ALLOWED_FONTS = [
    'Times New Roman',
    'Arial',
    'Calibri',
    'Cambria',
    'Georgia',
    'Verdana',
    'Courier New',
]

ALLOWED_SIZES = [9, 10, 10.5, 11, 12, 13, 14]
ALLOWED_WIDTHS = [25, 40, 50, 65, 80, 100]
ALLOWED_ALIGNS = ['left', 'center']
MAX_FIGURE_BYTES = 1572864  # 1.5 MB
MAX_FIGURES_COUNT = 12

PNG_PREFIX = 'data:image/png;base64,'
JPEG_PREFIX = 'data:image/jpeg;base64,'


def clean_paper(paper: dict) -> tuple[dict, list]:
    errors = []
    if not isinstance(paper, dict):
        return {}, [{'loc': ['paper'], 'msg': 'Paper must be a dictionary object'}]

    paper_copy = copy.deepcopy(paper)

    # 1. Validate & normalize style
    style_raw = paper_copy.get('style')
    if style_raw is None:
        paper_copy['style'] = {'fontFamily': 'Times New Roman', 'fontSize': 11}
    elif not isinstance(style_raw, dict):
        errors.append({'loc': ['style'], 'msg': 'Style must be an object'})
        paper_copy['style'] = {'fontFamily': 'Times New Roman', 'fontSize': 11}
    else:
        # fontFamily
        font = style_raw.get('fontFamily', 'Times New Roman')
        if font is None or font == '':
            font = 'Times New Roman'
        if font not in ALLOWED_FONTS:
            errors.append({
                'loc': ['style', 'fontFamily'],
                'msg': f'Font family must be one of: {", ".join(ALLOWED_FONTS)}',
            })
            font = 'Times New Roman'

        # fontSize
        size_val = style_raw.get('fontSize', 11)
        if size_val is None or size_val == '':
            size_val = 11
        try:
            num_size = float(size_val)
            if num_size.is_integer():
                num_size = int(num_size)
            if num_size not in ALLOWED_SIZES:
                errors.append({
                    'loc': ['style', 'fontSize'],
                    'msg': f'Font size must be one of: {ALLOWED_SIZES}',
                })
                num_size = 11
        except (ValueError, TypeError):
            errors.append({
                'loc': ['style', 'fontSize'],
                'msg': f'Font size must be one of: {ALLOWED_SIZES}',
            })
            num_size = 11

        paper_copy['style'] = {'fontFamily': font, 'fontSize': num_size}

    # 2. Validate figures across sections & questions
    sections = paper_copy.get('sections', [])
    if not isinstance(sections, list):
        return paper_copy, errors

    total_figures = 0

    for s_idx, sec in enumerate(sections):
        if not isinstance(sec, dict):
            continue
        questions = sec.get('questions', [])
        if not isinstance(questions, list):
            continue

        for q_idx, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            fig = q.get('figure')
            if fig is None or fig == '':
                # Ensure missing or null figure is cleanly removed from dict
                q.pop('figure', None)
                continue

            if not isinstance(fig, dict):
                errors.append({
                    'loc': ['sections', s_idx, 'questions', q_idx, 'figure'],
                    'msg': 'Figure must be an object',
                })
                continue

            total_figures += 1
            if total_figures > MAX_FIGURES_COUNT:
                errors.append({
                    'loc': ['sections', s_idx, 'questions', q_idx, 'figure'],
                    'msg': f'Paper exceeds maximum limit of {MAX_FIGURES_COUNT} figures',
                })

            # Check src prefix
            src = fig.get('src')
            if not isinstance(src, str):
                errors.append({
                    'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'src'],
                    'msg': 'Image source must be a string data URI',
                })
            else:
                prefix = None
                if src.startswith(PNG_PREFIX):
                    prefix = PNG_PREFIX
                elif src.startswith(JPEG_PREFIX):
                    prefix = JPEG_PREFIX

                if not prefix:
                    errors.append({
                        'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'src'],
                        'msg': 'Image source must be a base64 PNG or JPEG data URI (rejecting remote, file, svg, webp)',
                    })
                else:
                    b64_data = src[len(prefix):]
                    try:
                        raw_bytes = base64.b64decode(b64_data, validate=True)
                        if len(raw_bytes) > MAX_FIGURE_BYTES:
                            errors.append({
                                'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'src'],
                                'msg': f'Image decoded size ({len(raw_bytes)} bytes) exceeds 1.5 MB limit',
                            })
                    except (binascii.Error, ValueError):
                        errors.append({
                            'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'src'],
                            'msg': 'Invalid base64 payload in image source',
                        })

            # widthPct
            width_pct = fig.get('widthPct', 50)
            if width_pct is None:
                width_pct = 50
            try:
                width_pct = int(width_pct)
                if width_pct not in ALLOWED_WIDTHS:
                    errors.append({
                        'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'widthPct'],
                        'msg': f'widthPct must be one of: {ALLOWED_WIDTHS}',
                    })
                    width_pct = 50
            except (ValueError, TypeError):
                errors.append({
                    'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'widthPct'],
                    'msg': f'widthPct must be one of: {ALLOWED_WIDTHS}',
                })
                width_pct = 50
            fig['widthPct'] = width_pct

            # align
            align = fig.get('align', 'center')
            if align is None:
                align = 'center'
            if align not in ALLOWED_ALIGNS:
                errors.append({
                    'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'align'],
                    'msg': f"align must be one of: {ALLOWED_ALIGNS}",
                })
                align = 'center'
            fig['align'] = align

            # caption
            caption = fig.get('caption')
            if caption is not None:
                if not isinstance(caption, str):
                    caption = str(caption)
                if len(caption) > 120:
                    errors.append({
                        'loc': ['sections', s_idx, 'questions', q_idx, 'figure', 'caption'],
                        'msg': 'Caption cannot exceed 120 characters',
                    })
                fig['caption'] = caption

    return paper_copy, errors
