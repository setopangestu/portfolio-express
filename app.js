const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const session = require('express-session');
const multer = require('multer');

require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ========== KONEKSI SUPABASE ==========
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ========== FUNGSI FIX URL (TAMBAH HTTPS OTOMATIS) ==========
function fixUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return 'https://' + url;
}

// ========== SETUP VIEW ENGINE ==========
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== MIDDLEWARE ==========
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'rahasia-session-seto',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static('public'));

// ========== FUNGSI CEK LOGIN ==========
function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/login');
}

// ========== ROUTES PUBLIC ==========

// Home
app.get('/', async (req, res) => {
    try {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.render('public/index', { 
            title: 'Seto Aji Pangestu',
            projects: projects || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading data');
    }
});

// About
app.get('/about', (req, res) => {
    res.render('public/about', { 
        title: 'Tentang Saya'
    });
});

// Skills Public
app.get('/skills', async (req, res) => {
    try {
        const { data: skills, error } = await supabase
            .from('skills')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.render('public/skills', { 
            title: 'Skill & Kompetensi',
            skills: skills || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading skills');
    }
});

// Experiences Public
app.get('/experiences', async (req, res) => {
    try {
        const { data: experiences, error } = await supabase
            .from('experiences')
            .select('*')
            .order('start_date', { ascending: false });

        if (error) throw error;
        res.render('public/experiences', { 
            title: 'Pengalaman Kerja',
            experiences: experiences || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading experiences');
    }
});

// Educations Public
app.get('/educations', async (req, res) => {
    try {
        const { data: educations, error } = await supabase
            .from('educations')
            .select('*')
            .order('year', { ascending: false });

        if (error) throw error;
        res.render('public/education', { 
            title: 'Pendidikan',
            educations: educations || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading educations');
    }
});

// Project Detail
app.get('/project/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: project, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.render('public/project-detail', { 
            title: project.title,
            project: project
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Project not found');
    }
});

// ========== FITUR KOMENTAR (URUTAN PENTING! /home HARUS DI ATAS) ==========

// GET semua komentar untuk halaman home (HARUS DI ATAS)
app.get('/api/comments/home', async (req, res) => {
    try {
        const { data: comments, error } = await supabase
            .from('comments')
            .select('*, projects(title)')
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(comments || []);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading comments' });
    }
});

// POST komentar baru dari home (project_id = null)
app.post('/api/comments/home', async (req, res) => {
    try {
        const { name, email, comment } = req.body;
        
        if (!name || !comment) {
            return res.status(400).json({ error: 'Nama dan komentar wajib diisi!' });
        }
        
        const { data, error } = await supabase
            .from('comments')
            .insert([{ 
                name, 
                email: email || null, 
                comment,
                project_id: null,
                is_approved: false
            }]);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Komentar berhasil dikirim! Menunggu persetujuan admin.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving comment' });
    }
});

// GET komentar untuk project tertentu (HARUS DI BAWAH)
app.get('/api/comments/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { data: comments, error } = await supabase
            .from('comments')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(comments || []);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading comments' });
    }
});

// POST komentar untuk project tertentu
app.post('/api/comments', async (req, res) => {
    try {
        const { project_id, name, email, comment } = req.body;
        
        if (!project_id || !name || !comment) {
            return res.status(400).json({ error: 'Nama dan komentar wajib diisi!' });
        }
        
        const { data, error } = await supabase
            .from('comments')
            .insert([{ 
                project_id, 
                name, 
                email: email || null, 
                comment,
                is_approved: false
            }]);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Komentar berhasil dikirim! Menunggu persetujuan admin.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving comment' });
    }
});

// ========== ROUTES ADMIN ==========

// Login
app.get('/login', (req, res) => {
    res.render('public/login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('public/login', { error: 'Username atau password salah!' });
    }
});

// Dashboard
app.get('/admin', isAuthenticated, async (req, res) => {
    try {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.render('admin/dashboard', { projects: projects || [] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading admin panel');
    }
});

// ========== ADMIN: PROJECTS ==========

app.get('/admin/projects-add', isAuthenticated, (req, res) => {
    res.render('admin/projects-add');
});

app.post('/admin/projects-add', isAuthenticated, async (req, res) => {
    const { title, description, tech_stack, github_url, live_url } = req.body;
    const techArray = tech_stack ? tech_stack.split(',').map(t => t.trim()) : [];
    
    const fixedGithubUrl = fixUrl(github_url);
    const fixedLiveUrl = fixUrl(live_url);
    
    const { error } = await supabase
        .from('projects')
        .insert([{ 
            title, 
            description, 
            tech_stack: techArray, 
            github_url: fixedGithubUrl, 
            live_url: fixedLiveUrl 
        }]);
    
    if (error) {
        console.error(error);
        res.send('Error adding project');
    } else {
        res.redirect('/admin');
    }
});

app.get('/admin/projects-edit/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: project, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.render('admin/projects-edit', { project: project });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading project');
    }
});

app.post('/admin/projects-edit/:id', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, tech_stack, github_url, live_url } = req.body;
        const techArray = tech_stack ? tech_stack.split(',').map(t => t.trim()) : [];

        const fixedGithubUrl = fixUrl(github_url);
        const fixedLiveUrl = fixUrl(live_url);

        let image_url = null;
        
        if (req.file) {
            const cleanName = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
            const fileName = `${Date.now()}_${cleanName}`;
            
            const { error: uploadError } = await supabaseAdmin.storage
                .from('project-images')
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
            
            if (uploadError) {
                return res.send('Error uploading image: ' + uploadError.message);
            }
            
            const { data: publicUrlData } = supabaseAdmin.storage
                .from('project-images')
                .getPublicUrl(fileName);
            image_url = publicUrlData.publicUrl;
        }

        const updateData = { 
            title, 
            description, 
            tech_stack: techArray, 
            github_url: fixedGithubUrl, 
            live_url: fixedLiveUrl 
        };
        if (image_url) updateData.image_url = image_url;

        await supabase.from('projects').update(updateData).eq('id', id);
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating project');
    }
});

app.get('/admin/projects-delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    
    const { data: project } = await supabase
        .from('projects')
        .select('image_url')
        .eq('id', id)
        .single();
    
    if (project.image_url) {
        const fileName = project.image_url.split('/').pop();
        await supabaseAdmin.storage.from('project-images').remove([fileName]);
    }
    
    await supabase.from('projects').delete().eq('id', id);
    res.redirect('/admin');
});

app.get('/admin/projects-remove-image/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: project } = await supabase
            .from('projects')
            .select('image_url')
            .eq('id', id)
            .single();
        
        if (project.image_url) {
            const fileName = project.image_url.split('/').pop();
            await supabaseAdmin.storage.from('project-images').remove([fileName]);
        }
        
        await supabase.from('projects').update({ image_url: null }).eq('id', id);
        
        res.redirect(`/admin/projects-edit/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error removing image');
    }
});

// ========== ADMIN: SKILLS ==========

app.get('/admin/skills', isAuthenticated, async (req, res) => {
    const { data: skills } = await supabase.from('skills').select('*');
    res.render('admin/skills', { skills: skills || [] });
});

app.get('/admin/skills-add', isAuthenticated, (req, res) => {
    res.render('admin/skills-add');
});

app.post('/admin/skills-add', isAuthenticated, async (req, res) => {
    const { name, level } = req.body;
    await supabase.from('skills').insert([{ name, level }]);
    res.redirect('/admin/skills');
});

app.get('/admin/skills-edit/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { data: skill } = await supabase.from('skills').select('*').eq('id', id).single();
    res.render('admin/skills-edit', { skill: skill });
});

app.post('/admin/skills-edit/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { name, level } = req.body;
    await supabase.from('skills').update({ name, level }).eq('id', id);
    res.redirect('/admin/skills');
});

app.get('/admin/skills-delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    await supabase.from('skills').delete().eq('id', id);
    res.redirect('/admin/skills');
});

// ========== ADMIN: EXPERIENCES ==========

app.get('/admin/experiences', isAuthenticated, async (req, res) => {
    const { data: experiences } = await supabase.from('experiences').select('*');
    res.render('admin/experiences', { experiences: experiences || [] });
});

app.get('/admin/experiences-add', isAuthenticated, (req, res) => {
    res.render('admin/experiences-add');
});

app.post('/admin/experiences-add', isAuthenticated, async (req, res) => {
    const { position, company, location, start_date, end_date, description } = req.body;
    await supabase.from('experiences').insert([{ 
        position, company, location, start_date, end_date, description 
    }]);
    res.redirect('/admin/experiences');
});

app.get('/admin/experiences-edit/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { data: experience } = await supabase.from('experiences').select('*').eq('id', id).single();
    res.render('admin/experiences-edit', { experience: experience });
});

app.post('/admin/experiences-edit/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { position, company, location, start_date, end_date, description } = req.body;
    await supabase.from('experiences').update({ position, company, location, start_date, end_date, description }).eq('id', id);
    res.redirect('/admin/experiences');
});

app.get('/admin/experiences-delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    await supabase.from('experiences').delete().eq('id', id);
    res.redirect('/admin/experiences');
});

// ========== ADMIN: EDUCATIONS ==========

app.get('/admin/educations', isAuthenticated, async (req, res) => {
    const { data: educations } = await supabase.from('educations').select('*');
    res.render('admin/educations', { educations: educations || [] });
});

app.get('/admin/educations-add', isAuthenticated, (req, res) => {
    res.render('admin/educations-add');
});

app.post('/admin/educations-add', isAuthenticated, async (req, res) => {
    const { degree, institution, year, description } = req.body;
    await supabase.from('educations').insert([{ degree, institution, year, description }]);
    res.redirect('/admin/educations');
});

app.get('/admin/educations-edit/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { data: education } = await supabase.from('educations').select('*').eq('id', id).single();
    res.render('admin/educations-edit', { education: education });
});

app.post('/admin/educations-edit/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { degree, institution, year, description } = req.body;
    await supabase.from('educations').update({ degree, institution, year, description }).eq('id', id);
    res.redirect('/admin/educations');
});

app.get('/admin/educations-delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    await supabase.from('educations').delete().eq('id', id);
    res.redirect('/admin/educations');
});

// ========== ADMIN: MANAGE COMMENTS ==========

app.get('/admin/comments', isAuthenticated, async (req, res) => {
    try {
        const { data: comments, error } = await supabase
            .from('comments')
            .select('*, projects(title)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.render('admin/comments', { comments: comments || [] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading comments');
    }
});

app.get('/admin/comments-approve/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('comments').update({ is_approved: true }).eq('id', id);
        res.redirect('/admin/comments');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/comments');
    }
});

app.get('/admin/comments-delete/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('comments').delete().eq('id', id);
        res.redirect('/admin/comments');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/comments');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ========== JALANKAN SERVER (UNTUK LOKAL) ==========
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`✅ Server lokal: http://localhost:${PORT}`);
        console.log(`🔐 Admin: http://localhost:${PORT}/login`);
    });
}

// ========== EXPORT UNTUK VERCEL (SERVERLESS) ==========
module.exports = app;